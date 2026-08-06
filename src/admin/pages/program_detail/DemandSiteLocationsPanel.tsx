import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";

import {
  createDemandSiteLocationMutationOptions,
  deleteDemandSiteLocationMutationOptions,
  demandSiteLocationsQueryOptions,
  promoteDemandSiteLocationMutationOptions,
  updateDemandSiteMutationOptions,
} from "../../api/admin/demandSites";
import {
  btnGhostClass,
  btnPrimaryClass,
  inputClass,
  panelLinkActionClass,
  zoneCardBtnClass,
  zoneCardBtnDangerClass,
  zoneCardFooterClass,
} from "../../uiClasses";
import { useToast } from "../../context/useToast";
import { geocodeAddress } from "../../utils/geocodeAddress";
import type { DemandSite, DemandSiteLocationShape } from "../../types";

const DEFAULT_CENTER: [number, number] = [36.5, 127.8];
const MIN_RADIUS_METERS = 1500;

// leaflet-draw가 그리기 완료 이벤트에 실어 보내는 layerType 값
const LAYER_TYPE = {
  CIRCLE: "circle",
  POLYGON: "polygon",
} as const;

const SHAPE_TYPE: Record<"RADIUS" | "POLYGON", DemandSiteLocationShape> = {
  RADIUS: "RADIUS",
  POLYGON: "POLYGON",
};

interface DemandSiteLocationsPanelProps {
  demandSite: DemandSite;
  programId: number;
  onClose: () => void;
}

interface PendingShape {
  layer: L.Layer;
  layerType: (typeof LAYER_TYPE)[keyof typeof LAYER_TYPE];
}

/**
 * 수요처 하위 거점(원형/다각형 관제구역)을 지도에서 직접 그려 추가/삭제하는 편집기입니다.
 * L툴바로 원(반경)과 다각형을 그리면 그 자리에서 이름을 물어보고 저장합니다.
 */
const DemandSiteLocationsPanel = ({
  demandSite,
  programId,
  onClose,
}: DemandSiteLocationsPanelProps) => {
  const [pendingShape, setPendingShape] = useState<PendingShape | null>(null);
  const [pendingName, setPendingName] = useState("");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnLayerRef = useRef<L.FeatureGroup | null>(null);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: locations = [], isSuccess: locationsLoaded } = useQuery(
    demandSiteLocationsQueryOptions(demandSite.id),
  );
  const createDemandSiteLocationMutation = useMutation(
    createDemandSiteLocationMutationOptions(queryClient),
  );
  const deleteDemandSiteLocationMutation = useMutation(
    deleteDemandSiteLocationMutationOptions(queryClient),
  );
  const updateDemandSiteMutation = useMutation(updateDemandSiteMutationOptions(queryClient));
  const promoteDemandSiteLocationMutation = useMutation(
    promoteDemandSiteLocationMutationOptions(queryClient),
  );

  // 기본 관제구역(원)도 거점 개수에 포함한다 — 거점이 이거 하나뿐이면 끄는 순간
  // 관제구역이 0개가 되므로, 다른 거점이 하나라도 더 있을 때만 비활성화/기본 설정을 허용한다.
  const hasBaseArea =
    demandSite.baseLat !== null && demandSite.baseLng !== null && demandSite.radius !== null;
  const canManageMultipleZones = (hasBaseArea ? 1 : 0) + locations.length >= 2;

  // 거점이 하나도 없으면 지도가 기본 좌표(전국 한복판)에 머물러서 어디에 그려야 할지
  // 알 수 없다. 수요처 관제 좌표(없으면 주소)를 기준으로 옮겨준다 — 실패해도 조용히 넘어간다.
  const centerOnDemandSite = () => {
    if (demandSite.baseLat !== null && demandSite.baseLng !== null) {
      mapRef.current?.setView([demandSite.baseLat, demandSite.baseLng], 14);

      return;
    }

    geocodeAddress(demandSite.address ?? "")
      .then((point) => {
        if (point && mapRef.current) mapRef.current.setView([point.lat, point.lng], 16);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (locationsLoaded && locations.length === 0) centerOnDemandSite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandSite.id, locationsLoaded, locations.length]);

  // 지도+그리기 툴바 초기화 (마운트 1회)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView(DEFAULT_CENTER, 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnLayerRef.current = drawnItems;

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: { allowIntersection: false, showArea: false },
        circle: { showRadius: true } as L.DrawOptions.CircleOptions,
        rectangle: false,
        polyline: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: drawnItems,
        remove: false,
        edit: false,
      },
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (rawEvent: L.LeafletEvent) => {
      const event = rawEvent as L.DrawEvents.Created;
      const layer = event.layer;
      const layerType = event.layerType as (typeof LAYER_TYPE)[keyof typeof LAYER_TYPE];

      // GPS 오차를 감안해 원형 거점은 최소 반경 1.5km를 보장한다 — 작게 그리면 자동으로 키운다
      if (layerType === LAYER_TYPE.CIRCLE) {
        const circle = layer as L.Circle;
        if (circle.getRadius() < MIN_RADIUS_METERS) {
          circle.setRadius(MIN_RADIUS_METERS);
        }
      }

      // 확인 모달에서 저장/취소를 누르기 전까지 그린 도형을 지도에 임시로 보여준다
      drawnLayerRef.current?.addLayer(layer);
      setPendingShape({ layer, layerType });
      setPendingName(layerType === LAYER_TYPE.CIRCLE ? "원형 거점" : "다각형 거점");
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 기존 거점들을 지도에 렌더링 (직접 그린 도형과 별개 레이어)
  useEffect(() => {
    const layerGroup = drawnLayerRef.current;
    const map = mapRef.current;

    if (!layerGroup || !map) return;

    layerGroup.clearLayers();

    // 수요처 자체에 잡아둔 기본 관제구역 — 거점과 구분되게 점선으로 깔아준다.
    // 여기서 편집하진 않고(수요처 수정 모달에서 관리), 어디까지가 관제 범위인지 보여준다.
    // 사용 안 함으로 꺼둔 경우엔 회색으로 표시해 실제 관제엔 안 쓰인다는 걸 구분해준다.
    if (demandSite.baseLat !== null && demandSite.baseLng !== null && demandSite.radius !== null) {
      L.circle([demandSite.baseLat, demandSite.baseLng], {
        radius: demandSite.radius,
        color: demandSite.baseAreaEnabled ? "#3182f6" : "#9aa1ab",
        weight: 2,
        dashArray: "6 4",
        fillOpacity: 0.06,
      })
        .bindTooltip(
          `${demandSite.name} 기본 관제구역${demandSite.baseAreaEnabled ? "" : " (사용 안 함)"}`,
        )
        .addTo(layerGroup);
    }

    locations.forEach((location) => {
      if (
        location.shapeType === SHAPE_TYPE.RADIUS &&
        location.baseLat !== null &&
        location.baseLng !== null &&
        location.radius !== null
      ) {
        L.circle([location.baseLat, location.baseLng], {
          radius: location.radius,
        })
          .bindTooltip(location.name)
          .addTo(layerGroup);
      } else if (location.shapeType === SHAPE_TYPE.POLYGON && location.polygon) {
        L.polygon(location.polygon.map((point) => [point.lat, point.lng] as [number, number]))
          .bindTooltip(location.name)
          .addTo(layerGroup);
      }
    });

    const bounds = layerGroup.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }
  }, [locations, demandSite]);

  const handleToggleBaseAreaButtonClick = () => {
    const nextEnabled = !demandSite.baseAreaEnabled;

    updateDemandSiteMutation.mutate(
      { id: demandSite.id, programId, data: { baseAreaEnabled: nextEnabled } },
      {
        onSuccess: () =>
          showToast(`기본 관제구역 사용을 ${nextEnabled ? "켰습니다" : "껐습니다"}.`),
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handlePromoteButtonClick = (locationId: number) => {
    if (
      !confirm(
        "이 거점을 기본 관제구역으로 설정하시겠습니까? 이 거점은 삭제되고, 기존 기본 관제구역은 이 값으로 바뀝니다.",
      )
    ) {
      return;
    }

    promoteDemandSiteLocationMutation.mutate(
      { locationId, demandSiteId: demandSite.id, programId },
      {
        onSuccess: () => showToast("기본 관제구역으로 설정했습니다."),
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleDeleteButtonClick = (locationId: number) => {
    if (!confirm("이 거점을 삭제하시겠습니까?")) return;

    deleteDemandSiteLocationMutation.mutate(
      { locationId, demandSiteId: demandSite.id },
      {
        onSuccess: () => showToast("거점을 삭제했습니다."),
        onError: (error) => alert(error instanceof Error ? error.message : "삭제에 실패했습니다."),
      },
    );
  };

  const handleCancelPendingShapeButtonClick = () => {
    if (pendingShape) drawnLayerRef.current?.removeLayer(pendingShape.layer);

    setPendingShape(null);
    setPendingName("");
  };

  const handleSavePendingShapeButtonClick = () => {
    if (!pendingShape || !pendingName) return;

    const data =
      pendingShape.layerType === LAYER_TYPE.CIRCLE
        ? (() => {
            const circle = pendingShape.layer as L.Circle;
            const center = circle.getLatLng();
            return {
              name: pendingName,
              shapeType: SHAPE_TYPE.RADIUS,
              baseLat: center.lat,
              baseLng: center.lng,
              radius: Math.round(Math.max(circle.getRadius(), MIN_RADIUS_METERS)),
            };
          })()
        : (() => {
            const polygon = pendingShape.layer as L.Polygon;
            const latLngs = (polygon.getLatLngs()[0] as L.LatLng[]).map((point) => ({
              lat: point.lat,
              lng: point.lng,
            }));
            return { name: pendingName, shapeType: SHAPE_TYPE.POLYGON, polygon: latLngs };
          })();

    createDemandSiteLocationMutation.mutate(
      { demandSiteId: demandSite.id, data },
      {
        onSuccess: () => {
          showToast(`'${pendingName}' 거점을 추가했습니다.`);
          setPendingShape(null);
          setPendingName("");
        },
        onError: (error) => alert(error instanceof Error ? error.message : "저장에 실패했습니다."),
      },
    );
  };

  // 수요처 주소로 지도 이동
  const handleFindAddressButtonClick = async () => {
    if (!demandSite.address) return;

    try {
      const geocoded = await geocodeAddress(demandSite.address);
      if (!geocoded) {
        alert("주소를 찾을 수 없습니다.");

        return;
      }
      const point: [number, number] = [geocoded.lat, geocoded.lng];

      if (searchMarkerRef.current) {
        searchMarkerRef.current.remove();
      }
      if (mapRef.current) {
        searchMarkerRef.current = L.marker(point, {
          icon: L.divIcon({
            className: "",
            html: '<div style="width:16px;height:16px;border-radius:50%;background:#3182f6;border:3px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.5);"></div>',
          }),
        })
          .bindPopup(`검색된 위치<br/>${demandSite.address}`)
          .addTo(mapRef.current)
          .openPopup();
        mapRef.current.setView(point, 17);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "주소 검색에 실패했습니다.");
    }
  };

  return (
    <div className="bg-[#f8f9fb] border-t border-b border-[#e2e5eb] p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[14px] font-bold text-[#1f2937]">
            {demandSite.name} — 거점/관제구역 편집
          </div>
          <div className="text-[12.5px] text-[#8b94a3] mt-[3px]">
            {demandSite.address ||
              "등록된 주소 없음 — 수요처 정보에서 주소를 넣으면 지도가 그 위치로 이동합니다."}
          </div>
        </div>
        <div className="flex items-center gap-3.5">
          {demandSite.address && (
            <button className={panelLinkActionClass} onClick={handleFindAddressButtonClick}>
              주소로 찾기
            </button>
          )}
          <button className={panelLinkActionClass} onClick={onClose}>
            저장 닫기
          </button>
        </div>
      </div>
      <div className="flex gap-5 items-start">
        <div className="w-[220px] flex-none flex flex-col gap-2">
          {locations.length === 0 && demandSite.baseLat === null && (
            <span className="text-[12.5px] text-[#9aa1ab]">
              지도 우측 툴바에서 원(반경) 또는 다각형을 그려 거점을 추가하세요.
            </span>
          )}
          {demandSite.baseLat !== null &&
            demandSite.baseLng !== null &&
            demandSite.radius !== null && (
              <div
                className={`bg-white border border-[#e2e5eb] rounded-lg p-3.5 ${
                  demandSite.baseAreaEnabled ? "" : "opacity-60"
                }`}
              >
                <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-[#1f2937]">
                  {demandSite.name} 기본 관제구역
                  <span
                    className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded-[3px] whitespace-nowrap ${
                      demandSite.baseAreaEnabled
                        ? "bg-[#eaf0f7] text-[#3a6ea8]"
                        : "bg-[#eef1f5] text-[#5b6472]"
                    }`}
                  >
                    {demandSite.baseAreaEnabled ? "기본" : "사용 안 함"}
                  </span>
                </div>
                <div className="text-[12px] text-[#8b94a3] mt-1.5">
                  원형 · 반경 {demandSite.radius}m
                </div>
                {(!demandSite.baseAreaEnabled || canManageMultipleZones) && (
                  <div className={zoneCardFooterClass}>
                    <button className={zoneCardBtnClass} onClick={handleToggleBaseAreaButtonClick}>
                      {demandSite.baseAreaEnabled ? "비활성화" : "활성화"}
                    </button>
                  </div>
                )}
              </div>
            )}
          {locations.map((location) => (
            <div key={location.id} className="bg-white border border-[#e2e5eb] rounded-lg p-3.5">
              <div className="text-[13.5px] font-bold text-[#1f2937]">{location.name}</div>
              <div className="text-[12px] text-[#8b94a3] mt-1.5">
                {location.shapeType === SHAPE_TYPE.RADIUS
                  ? `원형 · 반경 ${location.radius}m`
                  : `다각형 · 좌표 ${location.polygon?.length ?? 0}개`}
              </div>
              <div className={zoneCardFooterClass}>
                {canManageMultipleZones && location.shapeType === SHAPE_TYPE.RADIUS && (
                  <button
                    className={zoneCardBtnClass}
                    onClick={() => handlePromoteButtonClick(location.id)}
                  >
                    기본으로 설정
                  </button>
                )}
                <button
                  className={zoneCardBtnDangerClass}
                  onClick={() => handleDeleteButtonClick(location.id)}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
        <div
          ref={mapContainerRef}
          className="flex-1 h-[640px] border border-[#e2e5eb] rounded-lg"
        />
      </div>

      {pendingShape && (
        <div className="fixed inset-0 bg-[rgba(15,23,32,0.45)] z-[2000] flex items-center justify-center">
          <div className="bg-white rounded-[8px] shadow-xl w-[360px] p-5">
            <div className="text-[14px] font-bold mb-3">거점 이름을 입력하세요</div>
            <input
              autoFocus
              className={inputClass}
              value={pendingName}
              onChange={(event) => setPendingName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSavePendingShapeButtonClick();
              }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button className={btnGhostClass} onClick={handleCancelPendingShapeButtonClick}>
                취소
              </button>
              <button className={btnPrimaryClass} onClick={handleSavePendingShapeButtonClick}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DemandSiteLocationsPanel;
