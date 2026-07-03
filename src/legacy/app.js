const DB_NAME = "SeniorActivityDB";
const DB_VERSION = 1;
const STORE_NAME = "activity_logs";
let db;

// 한국(UTC+9) 등 로컴 시간대 기준 오늘 날짜를 반환 (토이스스트링은 UTC라 오전 9시 전 하루 전 날짜 반환 버그 있음)
function getLocalDateStr() {
  const now = new Date();
  return (
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0")
  );
}

let currentDisplayYear = new Date().getFullYear();
let currentDisplayMonth = new Date().getMonth() + 1; // 1~12

// 1. IndexedDB 초기화
const initDB = () => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
    }
  };
  request.onsuccess = (e) => {
    db = e.target.result;
    loadList();
  };
  request.onerror = (e) => {
    console.error("IndexedDB Error:", e);
  };
};

function customAlert(msg) {
  return new Promise((resolve) => {
    document.getElementById("modalMessage").innerText = msg;
    const btnOk = document.getElementById("modalBtnOk");
    const btnCancel = document.getElementById("modalBtnCancel");
    btnOk.innerText = "확인";
    btnCancel.style.display = "none";

    const onClick = () => {
      document.getElementById("customModal").style.display = "none";
      btnOk.removeEventListener("click", onClick);
      resolve(true);
    };
    btnOk.addEventListener("click", onClick);
    document.getElementById("customModal").style.display = "flex";
  });
}

function customConfirm(msg, okText = "확인", cancelText = "취소") {
  return new Promise((resolve) => {
    document.getElementById("modalMessage").innerText = msg;
    const btnOk = document.getElementById("modalBtnOk");
    const btnCancel = document.getElementById("modalBtnCancel");
    btnOk.innerText = okText;
    btnCancel.innerText = cancelText;
    btnCancel.style.display = "block";

    const onOk = () => {
      cleanup();
      resolve(true);
    };
    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      document.getElementById("customModal").style.display = "none";
      btnOk.removeEventListener("click", onOk);
      btnCancel.removeEventListener("click", onCancel);
    };

    btnOk.addEventListener("click", onOk);
    btnCancel.addEventListener("click", onCancel);
    document.getElementById("customModal").style.display = "flex";
  });
}

// 영구 저장소 권한 획득
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then((granted) => {
    console.log("Persistent storage granted:", granted);
  });
}

// 캔버스 설정
let userCanvas = document.getElementById("userCanvas");
let userCtx = userCanvas.getContext("2d");
let demandCanvas = document.getElementById("demandCanvas");
let demandCtx = demandCanvas.getContext("2d");

let drawing = false;

function setupCanvas(canvas, ctx) {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.clientHeight || 150;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.strokeStyle = "black";

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!drawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stop = (e) => {
    e.preventDefault();
    drawing = false;
    ctx.closePath();
  };

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stop);
  canvas.addEventListener("mouseout", stop);

  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  canvas.addEventListener("touchend", stop, { passive: false });
}

function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// 화면 전환
function showPage(pageId) {
  document
    .querySelectorAll(".content")
    .forEach((el) => (el.style.display = "none"));
  document.getElementById("page" + pageId).style.display = "flex";

  if (pageId === 6) {
    // 서명 캔버스 크기 재설정
    setupCanvas(userCanvas, userCtx);
    setupCanvas(demandCanvas, demandCtx);

    // 저장된 서명 불러오기
    const savedUserSign = localStorage.getItem("userSign");
    if (savedUserSign) {
      const img = new Image();
      img.onload = () =>
        userCtx.drawImage(img, 0, 0, userCanvas.width, userCanvas.height);
      img.src = savedUserSign;
    }

    const savedDemandSign = localStorage.getItem("demandSign");
    if (savedDemandSign) {
      const img = new Image();
      img.onload = () =>
        demandCtx.drawImage(img, 0, 0, demandCanvas.width, demandCanvas.height);
      img.src = savedDemandSign;
    }
  }
}

function updateMonthDisplay() {
  const el = document.getElementById("currentMonthDisplay");
  if (el) el.innerText = `${currentDisplayYear}년 ${currentDisplayMonth}월`;
}

function changeMonth(delta) {
  currentDisplayMonth += delta;
  if (currentDisplayMonth > 12) {
    currentDisplayMonth = 1;
    currentDisplayYear++;
  } else if (currentDisplayMonth < 1) {
    currentDisplayMonth = 12;
    currentDisplayYear--;
  }
  updateMonthDisplay();
  loadList();
}

function toggleAccidentInput(show) {
  document.getElementById("accidentDetailRow").style.display = show
    ? "flex"
    : "none";
  document.getElementById("accidentActionRow").style.display = show
    ? "flex"
    : "none";
}

// 페이지 2
function startNewLog() {
  isSavedOnPage6 = false;
  // 오늘 날짜 기본 세팅 및 미래 날짜 선택 방지
  const todayStr = getLocalDateStr();

  document.getElementById("actDate").value = "";
  document.getElementById("actStart").value = "";
  document.getElementById("actEnd").value = "";
  document.getElementById("startAmpm").value = "AM";
  document.getElementById("startHour").value = "";
  document.getElementById("startMin").value = "";
  document.getElementById("endAmpm").value = "PM";
  document.getElementById("endHour").value = "";
  document.getElementById("endMin").value = "";
  document.getElementById("actTotalTime").innerText = "- 시간";
  document.getElementById("actContent").value = "";
  document.getElementById("actPlace").value = "";
  document.getElementById("accidentDetail").value = "";
  document.querySelector('input[name="accident"][value="무"]').checked = true;
  document.querySelector(
    'input[name="accidentAction"][value="업무수행"]',
  ).checked = true;
  document.getElementById("actTotalTime").innerText = "- 시간";
  toggleAccidentInput(false);
  showPage(3);
}

function calcTotalTime(start, end) {
  if (!start || !end) return "";
  const s = start.split(":");
  const e = end.split(":");
  let sMin = parseInt(s[0]) * 60 + parseInt(s[1]);
  let eMin = parseInt(e[0]) * 60 + parseInt(e[1]);
  if (eMin < sMin) eMin += 24 * 60; // 다음날
  const diff = eMin - sMin;
  const hours = Math.floor(diff / 60);
  return `${hours}시간`;
}

// 총 시간 실시간 계산
const updateTotalTime = () => {
  const start = document.getElementById("actStart").value;
  const end = document.getElementById("actEnd").value;
  const total = calcTotalTime(start, end);
  document.getElementById("actTotalTime").innerText = total ? total : "- 시간";
};

function updateHiddenTime(type) {
  const ampm = document.getElementById(`${type}Ampm`).value;
  const h = document.getElementById(`${type}Hour`).value;
  const m = document.getElementById(`${type}Min`).value;
  const hidden = document.getElementById(
    type === "start" ? "actStart" : "actEnd",
  );
  if (ampm && h && m) {
    let hour24 = parseInt(h);
    if (ampm === "PM" && hour24 !== 12) hour24 += 12;
    if (ampm === "AM" && hour24 === 12) hour24 = 0;
    hidden.value = `${String(hour24).padStart(2, "0")}:${m}`;
    updateTotalTime();
  } else {
    hidden.value = "";
    updateTotalTime();
  }
}

async function savePage3() {
  const date = document.getElementById("actDate").value;
  const start = document.getElementById("actStart").value;
  const end = document.getElementById("actEnd").value;
  const total = document.getElementById("actTotalTime").innerText;

  if (!date || !start || !end) {
    await customAlert("활동일과 시작, 종료 시간을 모두 입력해 주세요.");
    return;
  }

  const startMin = parseInt(start.split(":")[1]);
  const endMin = parseInt(end.split(":")[1]);
  if (startMin % 10 !== 0 || endMin % 10 !== 0) {
    await customAlert(
      "시간은 10분 단위(00, 10, 20, 30, 40, 50분)로만 입력 가능합니다.",
    );
    return;
  }

  const todayStr = getLocalDateStr();
  if (date > todayStr) {
    await customAlert("미래의 날짜로는 일지를 작성할 수 없습니다.");
    return;
  } else if (date === todayStr && end) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [h, m] = end.split(":");
    const endMinutes = parseInt(h) * 60 + parseInt(m);
    if (endMinutes > currentMinutes) {
      await customAlert(
        "현재 시간 이후(미래 시간)로 일지를 종료할 수 없습니다.",
      );
      return;
    }
  }

  let msg = `활동일\n${date}\n\n활동시간\n시작 ${start} ~ 종료 ${end}\n${total} 입니다.`;
  await customAlert(msg);
}

async function nextFromPage3() {
  const date = document.getElementById("actDate").value;
  const start = document.getElementById("actStart").value;
  const end = document.getElementById("actEnd").value;
  let errors = [];
  if (!date) errors.push("활동일자를 입력해 주세요.");
  if (!start) errors.push("시작 시간을 입력해 주세요.");
  if (!end) errors.push("종료 시간을 입력해 주세요.");

  if (start && end) {
    const startMin = parseInt(start.split(":")[1]);
    const endMin = parseInt(end.split(":")[1]);
    if (startMin % 10 !== 0 || endMin % 10 !== 0) {
      errors.push(
        "시간은 10분 단위(00, 10, 20, 30, 40, 50분)로만 지정해 주세요.",
      );
    }
  }

  // 미래 시간 방지 로직
  const todayStr = getLocalDateStr();
  if (date > todayStr) {
    errors.push("미래의 날짜로는 일지를 작성할 수 없습니다.");
  } else if (date === todayStr && end) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [h, m] = end.split(":");
    const endMinutes = parseInt(h) * 60 + parseInt(m);
    if (endMinutes > currentMinutes) {
      errors.push("현재 시간 이후(미래 시간)로 일지를 종료할 수 없습니다.");
    }
  }

  if (errors.length > 0) {
    await customAlert(errors.join("\n"));
    return;
  }
  showPage(4);
}

async function savePage4() {
  const content = document.getElementById("actContent").value.trim();
  const place = document.getElementById("actPlace").value.trim();

  if (!content || !place) {
    await customAlert("활동 내용과 장소를 모두 입력해 주세요.");
    return;
  }

  let msg = `활동내용은\n[${content}]\n\n활동장소는\n[${place}]\n입니다.`;
  await customAlert(msg);
}

async function nextFromPage4() {
  const content = document.getElementById("actContent").value.trim();
  const place = document.getElementById("actPlace").value.trim();
  let errors = [];
  if (!content) errors.push("활동 내용을 입력해 주세요.");
  if (!place) errors.push("활동 장소를 입력해 주세요.");

  if (errors.length > 0) {
    await customAlert(errors.join("\n"));
    return;
  }
  showPage(5);
}

async function savePage5() {
  const accident = document.querySelector(
    'input[name="accident"]:checked',
  ).value;
  if (accident === "유") {
    const detail = document.getElementById("accidentDetail").value.trim();
    if (!detail) {
      await customAlert("사고내용 및 조치내용을 입력해 주세요.");
      return;
    }
    const action = document.querySelector(
      'input[name="accidentAction"]:checked',
    ).value;
    await customAlert(
      `안전사고는\n[유] 이며\n\n안전사고 내용은\n[${detail}] 한 후\n\n업무는 [${action}] 하였습니다.`,
    );
  } else {
    await customAlert("안전사고 발생: 무");
  }
}

async function nextFromPage5() {
  const accident = document.querySelector(
    'input[name="accident"]:checked',
  ).value;
  const detail = document.getElementById("accidentDetail").value.trim();
  if (accident === "유" && !detail) {
    await customAlert("사고내용 및 조치내용을 입력해 주세요.");
    return;
  }
  showPage(6);
}

function isCanvasBlank(canvas) {
  const blank = document.createElement("canvas");
  blank.width = canvas.width;
  blank.height = canvas.height;
  return canvas.toDataURL() === blank.toDataURL();
}

async function saveLog() {
  const date = document.getElementById("actDate").value;
  const start = document.getElementById("actStart").value;
  const end = document.getElementById("actEnd").value;
  const content = document.getElementById("actContent").value;
  const place = document.getElementById("actPlace").value;
  const totalTime = calcTotalTime(start, end);

  const accident = document.querySelector(
    'input[name="accident"]:checked',
  ).value;
  const accidentDetail = document.getElementById("accidentDetail").value;
  const accidentAction = document.querySelector(
    'input[name="accidentAction"]:checked',
  ).value;

  let summaryMsg = `[최종 확인]\n\n활동일: ${date || "-"}\n시간: ${start || "-"} ~ ${end || "-"} (${totalTime})\n내용: ${content || "-"}\n\n위 내용으로 최종 저장하시겠습니까?`;

  const isConfirmed = await customConfirm(summaryMsg, "저장하기", "수정하기");
  if (!isConfirmed) {
    showPage(3);
    return;
  }

  if (isCanvasBlank(userCanvas)) {
    await customAlert("참여자 서명을 진행해주세요.");
    return;
  }

  const uCanvas = document.getElementById("userCanvas");
  const uSign = uCanvas.toDataURL("image/png");

  const dCanvas = document.getElementById("demandCanvas");
  const dSign = isCanvasBlank(dCanvas) ? "" : dCanvas.toDataURL("image/png");

  const demandConsent = document.getElementById("demandConsentCheck").checked;

  localStorage.setItem("userSign", uSign);
  if (dSign) {
    if (demandConsent) {
      localStorage.setItem("demandSign", dSign);
    } else {
      localStorage.removeItem("demandSign"); // 비동의시 자동저장 삭제
    }
  }

  const log = {
    date,
    start,
    end,
    totalTime: calcTotalTime(start, end),
    content,
    place,
    accident,
    accidentDetail,
    accidentAction,
    uSign,
    dSign,
    timestamp: new Date().getTime(),
  };

  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).add(log);
  tx.oncomplete = async () => {
    isSavedOnPage6 = true;
    await customAlert(
      "성공적으로 저장되었습니다.\n(보고서를 출력하시거나 '처음으로'를 눌러주세요)",
    );
    loadList();
  };
}

async function exportReportsFromPage6() {
  if (!isSavedOnPage6) {
    await customAlert("먼저 [저장하기]를 눌러 일지를 저장해주세요.");
    return;
  }
  exportReports();
}

async function goHomeFromPage6() {
  if (!isSavedOnPage6) {
    if (
      await customConfirm(
        "아직 일지를 저장하지 않았습니다.\n저장하지 않고 '처음으로' 돌아가시겠습니까?\n(수정을 원하시면 '취소'를 누르세요)",
      )
    ) {
      showPage(2);
    }
  } else {
    showPage(2);
  }
}

function loadList() {
  if (!db) return;
  const listEl = document.getElementById("activityList");
  listEl.innerHTML = "";
  updateMonthDisplay();

  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const req = store.getAll();

  req.onsuccess = (e) => {
    let logs = e.target.result || [];

    // 선택된 연/월 데이터만 필터링
    logs = logs.filter((log) => {
      const [y, m, d] = log.date.split("-");
      return (
        parseInt(y) === currentDisplayYear &&
        parseInt(m) === currentDisplayMonth
      );
    });

    if (logs.length === 0) {
      // 빈 상태일 때 그리드 속성 때문에 깨질 수 있으므로 임시 해제
      listEl.style.display = "block";
      listEl.innerHTML =
        "<div style='text-align:center; padding: 20px; color:#7f8c8d;'>이 달에 작성된 일지가 없습니다.</div>";
      return;
    } else {
      listEl.style.display = "grid";
    }

    // 최신 날짜가 위로 오게 정렬 (내림차순)
    logs
      .sort((a, b) => b.timestamp - a.timestamp)
      .forEach((log) => {
        const div = document.createElement("div");
        div.style.background = "#fff";
        div.style.padding = "8px 6px";
        div.style.borderRadius = "8px";
        div.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
        div.innerHTML = `
                <div style="font-weight:bold; color:#2c3e50; font-size:12px; margin-bottom: 3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${log.date}</div>
                <div style="color:#34495e; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${log.start}~${log.end}</div>
                <div style="color:#7f8c8d; font-size:11px; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${log.content}</div>
            `;
        listEl.appendChild(div);
      });
  };
}

async function exportReports() {
  await customAlert(
    "엑셀과 PDF 파일이 동시에 다운로드됩니다.\n잠시만 기다려주세요.",
  );
  generateExcel();
  setTimeout(() => {
    generatePDF();
  }, 1000); // 1초 간격으로 다운로드 실행
}

function getFileName(ext) {
  const org = localStorage.getItem("conf_org") || "기관명";
  const proj = localStorage.getItem("conf_proj") || "사업명";
  const user = localStorage.getItem("conf_user") || "참여자";
  const monthStr = String(currentDisplayMonth).padStart(2, "0");
  return `${currentDisplayYear}년${monthStr}월 ${org}. ${proj}. ${user}.${ext}`;
}

function generatePDF() {
  if (!db) return;
  const tx = db.transaction(STORE_NAME, "readonly");
  const req = tx.objectStore(STORE_NAME).getAll();

  req.onsuccess = async (e) => {
    let logs = e.target.result || [];

    logs = logs.filter((log) => {
      const [y, m, d] = log.date.split("-");
      return (
        parseInt(y) === currentDisplayYear &&
        parseInt(m) === currentDisplayMonth
      );
    });

    if (logs.length === 0) {
      await customAlert("해당 월에 출력할 일지 내역이 없습니다.");
      return;
    }

    // 1. 헤더 설정
    document.getElementById("pOrg").innerText =
      localStorage.getItem("conf_org") || "";
    document.getElementById("pProject").innerText =
      localStorage.getItem("conf_proj") || "";
    document.getElementById("pDemand").innerText =
      localStorage.getItem("conf_demand") || "";
    document.getElementById("pUser").innerText =
      localStorage.getItem("conf_user") || "";

    // 2. 바디(표) 그리기
    const tbody = document.getElementById("pRows");
    tbody.innerHTML = "";

    logs
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach((log, i) => {
        let accText = log.accident;
        if (log.accident === "유")
          accText += `<br>(${log.accidentDetail} / ${log.accidentAction})`;

        let userImg = `<img src="${log.uSign}" style="height:35px; width:auto;">`;
        let demandImg = log.dSign
          ? `<img src="${log.dSign}" style="height:35px; width:auto;">`
          : "";

        tbody.innerHTML += `
                <tr>
                    <td>${i + 1}</td>
                    <td>${log.date}</td>
                    <td>${log.start}</td>
                    <td>${log.end}</td>
                    <td>${log.totalTime}</td>
                    <td>${log.content}</td>
                    <td>${log.place}</td>
                    <td>${accText}</td>
                    <td>${userImg}</td>
                    <td>${demandImg}</td>
                </tr>
            `;
      });

    // 3. PDF 렌더링
    const element = document.getElementById("pdfContentWrapper");

    // 임시로 디스플레이 켜기
    const container = document.getElementById("pdfContainer");
    container.style.display = "block";
    container.style.position = "absolute";
    container.style.top = "0";
    container.style.left = "0";
    container.style.zIndex = "-9999";

    const opt = {
      margin: 10, // 상하좌우 여백 확보
      filename: getFileName("pdf"),
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    };

    // 시간 차이(Time Gap)로 인한 잘림 현상을 방지하기 위해 0.5초 대기 후 렌더링
    setTimeout(() => {
      html2pdf()
        .set(opt)
        .from(element)
        .save()
        .then(() => {
          container.style.display = "none"; // 다시 숨기기
        });
    }, 500);
  };
}

function generateExcel() {
  if (!db) return;
  const tx = db.transaction(STORE_NAME, "readonly");
  const req = tx.objectStore(STORE_NAME).getAll();

  req.onsuccess = async (e) => {
    let logs = e.target.result || [];

    logs = logs.filter((log) => {
      const [y, m, d] = log.date.split("-");
      return (
        parseInt(y) === currentDisplayYear &&
        parseInt(m) === currentDisplayMonth
      );
    });

    if (logs.length === 0) {
      await customAlert("해당 월에 출력할 일지 내역이 없습니다.");
      return;
    }

    const org = localStorage.getItem("conf_org") || "";
    const proj = localStorage.getItem("conf_proj") || "";
    const demand = localStorage.getItem("conf_demand") || "";
    const user = localStorage.getItem("conf_user") || "";

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("공익활동일지");

    // 양식에 맞게 헤더 세팅
    sheet.mergeCells("A1:J1");
    sheet.getCell("A1").value =
      "노인일자리 및 사회활동 지원사업 공익활동 활동일지(예시)";
    sheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getCell("A1").font = { size: 16, bold: true, underline: true };
    sheet.getRow(1).height = 40;

    sheet.mergeCells("B2:E2");
    sheet.mergeCells("G2:J2");
    sheet.mergeCells("B3:E3");
    sheet.mergeCells("G3:J3");

    sheet.getCell("A2").value = "기관명";
    sheet.getCell("B2").value = org;
    sheet.getCell("F2").value = "참여사업명";
    sheet.getCell("G2").value = proj;

    sheet.getCell("A3").value = "참여자 성명";
    sheet.getCell("B3").value = user;
    sheet.getCell("F3").value = "수요처명(서비스대상자명)";
    sheet.getCell("G3").value = demand;

    // 테이블 헤더 (병합 포함)
    sheet.mergeCells("A4:A5");
    sheet.getCell("A4").value = "연번";
    sheet.mergeCells("B4:B5");
    sheet.getCell("B4").value = "활동일";

    sheet.mergeCells("C4:E4");
    sheet.getCell("C4").value = "활동시간";
    sheet.getCell("C5").value = "시작(00:00)";
    sheet.getCell("D5").value = "종료(00:00)";
    sheet.getCell("E5").value = "총시간";

    sheet.mergeCells("F4:F5");
    sheet.getCell("F4").value = "활동내용";
    sheet.mergeCells("G4:G5");
    sheet.getCell("G4").value = "활동장소";
    sheet.mergeCells("H4:H5");
    sheet.getCell("H4").value = "안전사고 발생유무\n(사고내용, 조치내용)";
    sheet.mergeCells("I4:I5");
    sheet.getCell("I4").value = "참여자\n서명";
    sheet.mergeCells("J4:J5");
    sheet.getCell("J4").value = "확인자(수요처)\n서명";

    // 스타일 적용
    for (let i = 2; i <= 5; i++) {
      sheet.getRow(i).alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      sheet.getRow(i).eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    }

    [
      "A2",
      "F2",
      "A3",
      "F3",
      "A4",
      "B4",
      "C4",
      "F4",
      "G4",
      "H4",
      "I4",
      "J4",
      "C5",
      "D5",
      "E5",
    ].forEach((ref) => {
      sheet.getCell(ref).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0F0F0" },
      };
      sheet.getCell(ref).font = { bold: true };
    });

    // 컬럼 너비
    sheet.columns = [
      { width: 5 },
      { width: 12 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 25 },
      { width: 15 },
      { width: 20 },
      { width: 12 },
      { width: 12 },
    ];

    // 데이터 및 서명 삽입
    let startRow = 6;
    logs
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach((log, i) => {
        let accText = log.accident;
        if (log.accident === "유")
          accText += `\n(${log.accidentDetail} / ${log.accidentAction})`;

        const currentRow = startRow + i;
        const row = sheet.getRow(currentRow);
        row.height = 40;
        row.values = [
          i + 1,
          log.date,
          log.start,
          log.end,
          log.totalTime,
          log.content,
          log.place,
          accText,
          "",
          "",
        ];

        row.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });

        // 서명 이미지 삽입 (Base64 헤더 제거)
        if (log.uSign) {
          try {
            const base64Data = log.uSign.split(",")[1];
            const imgId = workbook.addImage({
              base64: base64Data,
              extension: "png",
            });
            sheet.addImage(imgId, {
              tl: { col: 8, row: currentRow - 1 },
              ext: { width: 45, height: 25 },
            });
          } catch (e) {}
        }
        if (log.dSign) {
          try {
            const base64Data = log.dSign.split(",")[1];
            const imgId = workbook.addImage({
              base64: base64Data,
              extension: "png",
            });
            sheet.addImage(imgId, {
              tl: { col: 9, row: currentRow - 1 },
              ext: { width: 45, height: 25 },
            });
          } catch (e) {}
        }
      });

    // 엑셀 내보내기
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = getFileName("xlsx");
    link.click();
  };
}

function renderTimeSelects() {
  const hours12 = Array.from({ length: 12 }, (_, i) =>
    String(i + 1).padStart(2, "0"),
  );
  const mins = ["00", "10", "20", "30", "40", "50"];

  let hourOptions =
    '<option value="" disabled selected>시</option>' +
    hours12.map((h) => `<option value="${h}">${h}</option>`).join("");
  let minOptions =
    '<option value="" disabled selected>분</option>' +
    mins.map((m) => `<option value="${m}">${m}</option>`).join("");

  document.getElementById("startHour").innerHTML = hourOptions;
  document.getElementById("startMin").innerHTML = minOptions;
  document.getElementById("endHour").innerHTML = hourOptions;
  document.getElementById("endMin").innerHTML = minOptions;
}

// 시작 로직
window.onload = () => {
  initDB();
  renderTimeSelects();

  const o = localStorage.getItem("conf_org");
  if (o) {
    const proj = localStorage.getItem("conf_proj") || "";
    document.getElementById("orgName").value = o;
    document.getElementById("projectName").value = proj;
    document.getElementById("demandName").value =
      localStorage.getItem("conf_demand") || "";
    document.getElementById("userName").value =
      localStorage.getItem("conf_user") || "";
    document.getElementById("dUser").innerText =
      localStorage.getItem("conf_user") || "";
    document.getElementById("topProjName").innerText = proj || "참여사업";
  }
  // 페이지 1 고정 표시 (사업명 변경 대비)
  showPage(1);
};

let isSavedOnPage6 = false;
