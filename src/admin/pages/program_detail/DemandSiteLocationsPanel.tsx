import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";

import {
  createDemandSiteLocation,
  deleteDemandSiteLocation,
  listDemandSiteLocations,
} from "../../api/admin/demandSites";
import {
  btnGhostClass,
  btnPrimaryClass,
  inputClass,
  rowActionBtnClass,
} from "../../uiClasses";
import { geocodeAddress } from "../../utils/geocodeAddress";
import type { DemandSite, DemandSiteLocation } from "../../types";

const DEFAULT_CENTER: [number, number] = [36.5, 127.8];
const MIN_RADIUS_METERS = 1500;

interface DemandSiteLocationsPanelProps {
  demandSite: DemandSite;
  onClose: () => void;
}

interface PendingShape {
  layer: L.Layer;
  layerType: "circle" | "polygon";
}

/**
 * 수요처 하위 거점(원형/다각형 관제구역)을 지도에서 직접 그려 추가/삭제하는 편집기입니다.
 * Leaflet.draw 툴바로 원(반경)과 다각형을 그리면 그 자리에서 이름을 물어보고 저장합니다.
 */
const DemandSiteLocationsPanel = ({
  demandSite,
  onClose,
}: DemandSiteLocationsPanelProps) => {
  const [locations, setLocations] = useState<DemandSiteLocation[]>([]);
  const [pendingShape, setPendingShape] = useState<PendingShape | null>(null);
  const [pendingName, setPendingName] = useState("");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnLayerRef = useRef<L.FeatureGroup | null>(null);
  const searchMarkerRef = useRef<L.Marker | null>(null);

  // 거점이 하나도 없으면 지도가 기본 좌표(전국 한복판)에 머물러서 어디에 그려야 할지
  // 알 수 없다. 수요처 관제 좌표(없으면 주소)를 기준으로 옮겨준다 — 실패해도 조용히 넘어간다.
  const centerOnDemandSite = () => {
    if (demandSite.baseLat !== null && demandSite.baseLng !== null) {
      mapRef.current?.setView([demandSite.baseLat, demandSite.baseLng], 14);

      return;
    }

    geocodeAddress(demandSite.address ?? "")
      .then((point) => {
        if (point && mapRef.current)
          mapRef.current.setView([point.lat, point.lng], 16);
      })
      .catch(() => {});
  };

  const refresh = () =>
    listDemandSiteLocations(demandSite.id).then((rows) => {
      setLocations(rows);
      if (rows.length === 0) centerOnDemandSite();
    });

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandSite.id]);

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
        // showArea: true는 그리는 동안 넓이를 툴팁에 보여주지만, leaflet-draw 1.0.4의
        // GeometryUtil.readableArea가 선언 없이 `type` 변수에 대입해서(비엄격 모드 전제) —
        // Vite가 번들링하는 ES 모듈은 항상 엄격 모드라 그 대입에서 ReferenceError가 터진다.
        // 다각형은 정점 3개부터 넓이가 생기므로 3번째 클릭에서 예외가 나며 이후 클릭까지
        // 다 깨진다. 넓이 표시는 부가 기능이라 꺼서 이 버그를 피한다.
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
      const layerType = event.layerType as "circle" | "polygon";

      // GPS 오차를 감안해 원형 거점은 최소 반경 1.5km를 보장한다 — 작게 그리면 자동으로 키운다
      if (layerType === "circle") {
        const circle = layer as L.Circle;
        if (circle.getRadius() < MIN_RADIUS_METERS) {
          circle.setRadius(MIN_RADIUS_METERS);
        }
      }

      // 확인 모달에서 저장/취소를 누르기 전까지 그린 도형을 지도에 임시로 보여준다
      drawnLayerRef.current?.addLayer(layer);
      setPendingShape({ layer, layerType });
      setPendingName(layerType === "circle" ? "원형 거점" : "다각형 거점");
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
    if (
      demandSite.baseLat !== null &&
      demandSite.baseLng !== null &&
      demandSite.radius !== null
    ) {
      L.circle([demandSite.baseLat, demandSite.baseLng], {
        radius: demandSite.radius,
        // 안전 관제 지도의 관제구역과 같은 파란 점선으로 맞춘다
        color: "#3182f6",
        weight: 2,
        dashArray: "6 4",
        fillOpacity: 0.06,
      })
        .bindTooltip(`${demandSite.name} 기본 관제구역`)
        .addTo(layerGroup);
    }

    locations.forEach((location) => {
      if (
        location.shapeType === "RADIUS" &&
        location.baseLat !== null &&
        location.baseLng !== null &&
        location.radius !== null
      ) {
        L.circle([location.baseLat, location.baseLng], {
          radius: location.radius,
        })
          .bindTooltip(location.name)
          .addTo(layerGroup);
      } else if (location.shapeType === "POLYGON" && location.polygon) {
        L.polygon(
          location.polygon.map(
            (point) => [point.lat, point.lng] as [number, number],
          ),
        )
          .bindTooltip(location.name)
          .addTo(layerGroup);
      }
    });

    const bounds = layerGroup.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }
  }, [locations, demandSite]);

  const handleDeleteButtonClick = async (locationId: number) => {
    if (!confirm("이 거점을 삭제하시겠습니까?")) return;
    try {
      await deleteDemandSiteLocation(locationId);
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  };

  const handleCancelPendingShapeButtonClick = () => {
    if (pendingShape) drawnLayerRef.current?.removeLayer(pendingShape.layer);
    setPendingShape(null);
    setPendingName("");
  };

  const handleSavePendingShapeButtonClick = async () => {
    if (!pendingShape || !pendingName) return;

    try {
      if (pendingShape.layerType === "circle") {
        const circle = pendingShape.layer as L.Circle;
        const center = circle.getLatLng();
        await createDemandSiteLocation(demandSite.id, {
          name: pendingName,
          shapeType: "RADIUS",
          baseLat: center.lat,
          baseLng: center.lng,
          radius: Math.round(Math.max(circle.getRadius(), MIN_RADIUS_METERS)),
        });
      } else {
        const polygon = pendingShape.layer as L.Polygon;
        const latLngs = (polygon.getLatLngs()[0] as L.LatLng[]).map(
          (point) => ({ lat: point.lat, lng: point.lng }),
        );
        await createDemandSiteLocation(demandSite.id, {
          name: pendingName,
          shapeType: "POLYGON",
          polygon: latLngs,
        });
      }
      setPendingShape(null);
      setPendingName("");
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  // 수요처 주소로 지도를 옮겨준다 (거점을 자동으로 만들지는 않음 — 지오코딩이 부정확할 수 있어서
  // 위치 확인은 관리자가 지도를 보고 직접 그리게 한다).
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
      alert(
        error instanceof Error ? error.message : "주소 검색에 실패했습니다.",
      );
    }
  };

  return (
    <div className="border border-[#e2e5eb] rounded-[2px] mt-2.5 bg-[#fafbfc]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#eceef1]">
        <div>
          <span className="text-[13px] font-bold">
            {demandSite.name} — 거점/관제구역 편집
          </span>
          <div className="text-[12px] text-[#6b7280] mt-0.5">
            {demandSite.address ||
              "등록된 주소 없음 — 수요처 정보에서 주소를 넣으면 지도가 그 위치로 이동합니다."}
          </div>
        </div>
        <div className="flex gap-1.5">
          {demandSite.address && (
            <button
              className={rowActionBtnClass}
              onClick={handleFindAddressButtonClick}
            >
              주소로 찾기
            </button>
          )}
          <button className={rowActionBtnClass} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
      <div className="flex gap-3 p-4">
        <div className="w-[240px] flex-none flex flex-col gap-2">
          {locations.length === 0 && (
            <span className="text-[12.5px] text-[#9aa1ab]">
              지도 우측 툴바에서 원(반경) 또는 다각형을 그려 거점을 추가하세요.
            </span>
          )}
          {locations.map((location) => (
            <div
              key={location.id}
              className="border border-[#e2e5eb] rounded-[2px] px-3 py-2 text-[12.5px]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{location.name}</span>
                <button
                  className="border border-[#f3c6c2] bg-[#fdecea] text-[#b42318] text-xs font-semibold px-2 py-1 rounded-[2px] cursor-pointer hover:bg-[#fbdedb]"
                  onClick={() => handleDeleteButtonClick(location.id)}
                >
                  삭제
                </button>
              </div>
              <div className="text-[#6b7280] mt-1">
                {location.shapeType === "RADIUS"
                  ? `원형 · 반경 ${location.radius}m`
                  : `다각형 · 좌표 ${location.polygon?.length ?? 0}개`}
              </div>
            </div>
          ))}
        </div>
        <div
          ref={mapContainerRef}
          className="flex-1 h-[640px] border border-[#e2e5eb] rounded-[2px]"
        />
      </div>

      {pendingShape && (
        <div className="fixed inset-0 bg-[rgba(15,23,32,0.45)] z-[2000] flex items-center justify-center">
          <div className="bg-white rounded-[8px] shadow-xl w-[360px] p-5">
            <div className="text-[14px] font-bold mb-3">
              거점 이름을 입력하세요
            </div>
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
              <button
                className={btnGhostClass}
                onClick={handleCancelPendingShapeButtonClick}
              >
                취소
              </button>
              <button
                className={btnPrimaryClass}
                onClick={handleSavePendingShapeButtonClick}
              >
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
