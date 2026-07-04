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
