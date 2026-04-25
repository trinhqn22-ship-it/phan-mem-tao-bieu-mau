// Format currency
function formatVND(number) {
    if (isNaN(number)) return "0";
    return new Intl.NumberFormat('vi-VN').format(Math.round(number));
}

// Convert Date string YYYY-MM-DD to DD/MM/YYYY
function formatDateToVN(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Convert Date string YYYY-MM-DD to "ngày DD tháng MM năm YYYY"
function formatDateToText(dateStr) {
    if (!dateStr) return 'ngày ... tháng ... năm ...';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `ngày ${parts[2]} tháng ${parts[1]} năm ${parts[0]}`;
}

// Read money in Vietnamese (Đọc tiền bằng chữ)
const ChuSo = [" không", " một", " hai", " ba", " bốn", " năm", " sáu", " bảy", " tám", " chín"];
const Tien = ["", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ"];

function docSo3ChuSo(baso) {
    let tram, chuc, donvi, KetQua = "";
    tram = parseInt(baso / 100);
    chuc = parseInt((baso % 100) / 10);
    donvi = baso % 10;
    if (tram == 0 && chuc == 0 && donvi == 0) return "";
    if (tram != 0) {
        KetQua += ChuSo[tram] + " trăm";
        if ((chuc == 0) && (donvi != 0)) KetQua += " linh";
    }
    if ((chuc != 0) && (chuc != 1)) {
        KetQua += ChuSo[chuc] + " mươi";
        if ((chuc == 0) && (donvi != 0)) KetQua += " linh";
    }
    if (chuc == 1) KetQua += " mười";
    switch (donvi) {
        case 1:
            if ((chuc != 0) && (chuc != 1)) KetQua += " mốt";
            else KetQua += ChuSo[donvi];
            break;
        case 5:
            if (chuc == 0) KetQua += ChuSo[donvi];
            else KetQua += " lăm";
            break;
        default:
            if (donvi != 0) KetQua += ChuSo[donvi];
            break;
    }
    return KetQua;
}

function docTienBangChu(SoTien) {
    let lan = 0;
    let i = 0;
    let KetQua = "";
    let tmp = "";
    let ViTri = new Array();
    if (SoTien < 0) return "Số tiền âm!";
    if (SoTien == 0) return "Không đồng";
    if (SoTien > 8999999999999999) return "Số quá lớn!";
    
    SoTien = Math.round(SoTien);

    ViTri[5] = Math.floor(SoTien / 1000000000000000);
    if (isNaN(ViTri[5])) ViTri[5] = "0";
    SoTien = SoTien - parseFloat(ViTri[5].toString()) * 1000000000000000;
    
    ViTri[4] = Math.floor(SoTien / 1000000000000);
    if (isNaN(ViTri[4])) ViTri[4] = "0";
    SoTien = SoTien - parseFloat(ViTri[4].toString()) * 1000000000000;
    
    ViTri[3] = Math.floor(SoTien / 1000000000);
    if (isNaN(ViTri[3])) ViTri[3] = "0";
    SoTien = SoTien - parseFloat(ViTri[3].toString()) * 1000000000;
    
    ViTri[2] = parseInt(SoTien / 1000000);
    if (isNaN(ViTri[2])) ViTri[2] = "0";
    
    ViTri[1] = parseInt((SoTien % 1000000) / 1000);
    if (isNaN(ViTri[1])) ViTri[1] = "0";
    
    ViTri[0] = parseInt(SoTien % 1000);
    if (isNaN(ViTri[0])) ViTri[0] = "0";
    
    if (ViTri[5] > 0) lan = 5;
    else if (ViTri[4] > 0) lan = 4;
    else if (ViTri[3] > 0) lan = 3;
    else if (ViTri[2] > 0) lan = 2;
    else if (ViTri[1] > 0) lan = 1;
    else lan = 0;
    
    for (i = lan; i >= 0; i--) {
        tmp = docSo3ChuSo(ViTri[i]);
        KetQua += tmp;
        if (ViTri[i] > 0) KetQua += Tien[i];
        if ((i > 0) && (tmp.length > 0)) KetQua += "";
    }
    
    if (KetQua.substring(KetQua.length - 1) == ",") {
        KetQua = KetQua.substring(0, KetQua.length - 1);
    }
    
    KetQua = KetQua.trim();
    if(KetQua.length === 0) return "";
    return KetQua.substring(0, 1).toUpperCase() + KetQua.substring(1) + " đồng.";
}
