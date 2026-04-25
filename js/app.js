let state = {};

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // Tải dữ liệu từ LocalStorage hoặc dùng mặc định
    const savedData = localStorage.getItem('formData');
    if (savedData) {
        try {
            state = JSON.parse(savedData);
        } catch (e) {
            state = JSON.parse(JSON.stringify(defaultData));
        }
    } else {
        state = JSON.parse(JSON.stringify(defaultData));
    }

    bindTabs();
    bindInputs();
    bindActions();
    if (typeof initAI === 'function') initAI(); // Khởi tạo AI Module
    renderItemsForm();
    updatePreview();
}

function bindTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const panes = document.querySelectorAll('.tab-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    const docBtns = document.querySelectorAll('.btn-doc');
    docBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            docBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updatePreview();
            
            // Switch to preview mode on mobile
            document.body.classList.add('mobile-preview-mode');
            // Scroll to top of preview
            window.scrollTo(0, 0);
        });
    });

    // Mobile Back Button logic
    const btnBackInput = document.getElementById('btn-back-input');
    if (btnBackInput) {
        btnBackInput.addEventListener('click', () => {
            document.body.classList.remove('mobile-preview-mode');
            // Scroll to top of input form
            window.scrollTo(0, 0);
        });
    }
}

function bindInputs() {
    // Map object keys to DOM input IDs
    const inputs = Object.keys(defaultData).filter(k => k !== 'items');
    inputs.forEach(key => {
        const el = document.getElementById(key);
        if (el) {
            if (el.type === 'checkbox') {
                el.checked = state[key];
                el.addEventListener('change', (e) => {
                    state[key] = e.target.checked;
                    updatePreview();
                });
            } else {
                el.value = state[key];
                el.addEventListener('input', (e) => {
                    let val = e.target.value;
                    if (el.type === 'number') val = parseFloat(val) || 0;
                    state[key] = val;
                    updatePreview();
                });
            }
        }
    });
}

function bindActions() {
    // Watermark Image Upload
    document.getElementById('watermarkImage')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                state.watermarkImageBase64 = event.target.result;
                updatePreview();
            };
            reader.readAsDataURL(file);
        } else {
            state.watermarkImageBase64 = null;
            updatePreview();
        }
    });

    // Add Item
    document.getElementById('btn-add-item').addEventListener('click', () => {
        state.items.push({ name: "", desc: "", unit: "", qty: "", price: "" });
        renderItemsForm();
        updatePreview();
    });

    // Save Local
    document.getElementById('btn-save-local').addEventListener('click', () => {
        localStorage.setItem('formData', JSON.stringify(state));
        alert('Đã lưu dữ liệu vào trình duyệt!');
    });

    // Sync to Google Sheets
    const inputSheetUrl = document.getElementById('sheetWebhookUrl');
    const savedSheetUrl = KeyManager.loadSheetUrl();
    if (savedSheetUrl) inputSheetUrl.value = savedSheetUrl;

    document.getElementById('btn-toggle-sheet-key').addEventListener('click', () => {
        inputSheetUrl.type = inputSheetUrl.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('btn-save-sheet-url').addEventListener('click', () => {
        try {
            KeyManager.saveSheetUrl(inputSheetUrl.value);
            alert('Lưu URL đồng bộ thành công!');
        } catch (e) {
            alert(e.message);
        }
    });

    document.getElementById('btn-sync-cloud').addEventListener('click', async () => {
        const url = KeyManager.loadSheetUrl() || inputSheetUrl.value.trim();
        if (!url) {
            alert('Vui lòng nhập và lưu Google Sheets Webhook URL trong tab Cài đặt trước!');
            return;
        }

        const btn = document.getElementById('btn-sync-cloud');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đồng bộ...';
        btn.disabled = true;

        try {
            const activeType = document.querySelector('.btn-doc.active').dataset.type;
            const docTypeStr = activeType === 'order' ? 'Đơn Đặt Hàng' : (activeType === 'quote' ? 'Báo Giá' : 'Hợp Đồng');

            // Format payload
            const payload = {
                timestamp: new Date().toISOString(),
                docType: docTypeStr,
                docNo: activeType === 'order' ? state.orderNo : (activeType === 'quote' ? state.quoteNo : state.contractNo),
                customerName: state.customerName,
                customerPhone: state.customerPhone,
                totalAmount: calculateTotals().total,
                itemsCount: state.items.length,
                rawJSON: JSON.stringify(state)
            };

            const response = await fetch(url, {
                method: 'POST',
                // Google Apps Script usually expects text/plain or application/x-www-form-urlencoded to avoid CORS preflight, 
                // but if using POST body JSON, we just send text/plain containing JSON.
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                if(result.status === 'success') {
                    alert('Đã đồng bộ đơn hàng lên Google Sheets thành công!');
                } else {
                    alert('Đồng bộ thất bại: ' + result.message);
                }
            } else {
                throw new Error('Lỗi kết nối tới Google Sheets');
            }
        } catch (error) {
            console.error(error);
            alert('Lỗi đồng bộ: ' + error.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    // Export JSON
    document.getElementById('btn-export-json').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `BieuMau_${new Date().getTime()}.json`);
        dlAnchorElem.click();
    });

    // Import JSON
    document.getElementById('file-import-json').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                state = imported;
                bindInputs(); // update values in DOM
                renderItemsForm();
                updatePreview();
                alert('Đã tải dữ liệu thành công!');
            } catch (err) {
                alert('File không hợp lệ!');
            }
        };
        reader.readAsText(file);
    });

    // Print
    document.getElementById('btn-print').addEventListener('click', () => {
        window.print();
    });

    // PDF
    document.getElementById('btn-pdf').addEventListener('click', async () => {
        const element = document.getElementById('preview-content');
        const activeType = document.querySelector('.btn-doc.active').dataset.type;
        const filename = activeType === 'order' ? `Don_Dat_Hang_${state.orderNo}.pdf` : 
                         activeType === 'quote' ? `Bao_Gia_${state.quoteNo}.pdf` : 
                         `Hop_Dong_${state.contractNo}.pdf`;
        
        // --- XỬ LÝ WATERMARK & MARGIN ĐA TRANG ---
        const originalWm = element.querySelector('.watermark');
        if (originalWm) originalWm.style.display = 'none';

        // Lấy nguồn ảnh watermark (ưu tiên ảnh người dùng up, nếu không có thì dùng mặc định)
        const wmSrc = state.watermarkImageBase64 || (typeof DEFAULT_WATERMARK_B64 !== 'undefined' ? DEFAULT_WATERMARK_B64 : null);
        
        let watermarkBase64 = null;
        if (state.showWatermark && wmSrc) {
            const img = new Image();
            img.src = wmSrc;
            await new Promise(r => { img.onload = r; img.onerror = r; });
            if (img.width > 0) {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.globalAlpha = 0.1; // Độ mờ 10%
                ctx.drawImage(img, 0, 0);
                watermarkBase64 = canvas.toDataURL('image/png');
            }
        }

        // Độ rộng nội dung 186mm (để bù 12mm lề mỗi bên thành 210mm)
        const originalPadding = element.style.padding;
        const originalWidth = element.style.width;
        
        element.style.padding = '0';
        element.style.width = '186mm';

        const opt = {
            margin:       [10, 12, 10, 12], 
            filename:     filename.replace(/\//g, '_'),
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: {
                mode: ['css', 'legacy'],
                avoid: [
                  '.contract-section',
                  '.contract-article',
                  '.signature-section',
                  'table',
                  'tr',
                  '.total-section',
                  '.payment-section'
                ]
            }
        };

        // Tạo PDF và nhúng watermark trực tiếp vào từng trang PDF (tránh lỗi lệch trang do html2pdf cắt trang tự động)
        await html2pdf().set(opt).from(element).toPdf().get('pdf').then(function (pdf) {
            if (watermarkBase64) {
                const totalPages = pdf.internal.getNumberOfPages();
                for (let i = 1; i <= totalPages; i++) {
                    pdf.setPage(i);
                    // Kích thước A4 là 210x297. Watermark 147x207.9. Tọa độ tâm là 31.5, 44.55
                    pdf.addImage(watermarkBase64, 'PNG', 31.5, 44.55, 147, 207.9);
                }
            }
        }).save();

        // Dọn dẹp DOM
        element.style.padding = originalPadding;
        element.style.width = originalWidth;
        if (originalWm) originalWm.style.display = 'flex';
    });
}

function renderItemsForm() {
    const container = document.getElementById('items-container');
    container.innerHTML = '';

    state.items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'item-row';
        div.innerHTML = `
            <button class="btn-remove" onclick="removeItem(${index})" title="Xóa"><i class="fa-solid fa-trash"></i></button>
            <div class="form-group">
                <label>Tên hàng hóa</label>
                <input type="text" class="form-control" value="${item.name}" oninput="updateItem(${index}, 'name', this.value)" placeholder="Ví dụ: Áo bảo hộ lao động">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Đơn vị tính</label>
                    <input type="text" class="form-control" value="${item.unit}" oninput="updateItem(${index}, 'unit', this.value)" placeholder="Bộ / Cái / Đôi">
                </div>
                <div class="form-group">
                    <label>Số lượng</label>
                    <input type="number" class="form-control" value="${item.qty}" oninput="updateItem(${index}, 'qty', this.value)" placeholder="Nhập số lượng">
                </div>
                <div class="form-group">
                    <label>Đơn giá</label>
                    <input type="number" class="form-control" value="${item.price}" oninput="updateItem(${index}, 'price', this.value)" placeholder="Ví dụ: 120000">
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

window.removeItem = function(index) {
    state.items.splice(index, 1);
    renderItemsForm();
    updatePreview();
};

window.updateItem = function(index, field, value) {
    if (field === 'qty' || field === 'price') value = value === '' ? '' : (parseFloat(value) || 0);
    state.items[index][field] = value;
    updatePreview();
};

// =================== LOGIC PREVIEW =================== //

function calculateTotals() {
    let subtotal = 0;
    state.items.forEach(item => {
        subtotal += item.qty * item.price;
    });

    let vat = 0;
    if (state.showVat) {
        vat = subtotal * (state.vatPercent / 100);
    }

    const total = subtotal + vat;
    let deposit = total * (state.depositPercent / 100);

    // Xử lý tiền cọc cứng (từ AI)
    if (state.depositAmountFixed && state.depositAmountFixed > 0) {
        deposit = state.depositAmountFixed;
        // Cập nhật lại phần trăm hiển thị ở ô input (nếu muốn)
        state.depositPercent = parseFloat((deposit / total * 100).toFixed(2)) || 0;
        const dpEl = document.getElementById('depositPercent');
        if(dpEl) dpEl.value = state.depositPercent;
    }

    const remain = total - deposit;

    return { subtotal, vat, total, deposit, remain };
}

function updatePreview() {
    const type = document.querySelector('.btn-doc.active').dataset.type;
    const container = document.getElementById('preview-content');
    
    if (type === 'order') {
        container.classList.add('order-layout');
    } else {
        container.classList.remove('order-layout');
    }
    
    let html = '';
    if (state.showWatermark) {
        if (state.watermarkImageBase64) {
            html += `<div class="watermark"><img src="${state.watermarkImageBase64}" alt="watermark"></div>`;
        } else if (typeof DEFAULT_WATERMARK_B64 !== 'undefined') {
            html += `<div class="watermark"><img src="${DEFAULT_WATERMARK_B64}" alt="watermark"></div>`;
        }
    }

    if (type === 'order') {
        html += generateOrder();
    } else if (type === 'quote') {
        html += generateQuote();
    } else if (type === 'contract') {
        html += generateContract();
    }

    container.innerHTML = html;
}

function autoFitOrder() {
    const container = document.getElementById('preview-content');
    if (!container) return;

    // Reset inline styles
    container.style.fontSize = '';
    const dataTable = container.querySelector('.data-table');
    if (dataTable) {
        dataTable.querySelectorAll('th, td').forEach(cell => {
            cell.style.padding = '';
        });
        dataTable.style.fontSize = '';
    }
    const signatureNameAll = container.querySelectorAll('.signature-name');
    signatureNameAll.forEach(el => el.style.marginTop = '');
    
    // A4 height at 96dpi is ~1122px. We use 1120px to be safe.
    const MAX_HEIGHT = 1120;
    
    let attempts = 0;
    let fontSize = 11.5;
    let tablePadding = 4;
    let tableFontSize = 11;
    let signatureMargin = 80;

    // Nếu cuộn dọc dài hơn giới hạn trang A4 thì giảm kích thước
    while (container.scrollHeight > MAX_HEIGHT && attempts < 6) {
        fontSize -= 0.5;
        tablePadding = Math.max(1, tablePadding - 0.5);
        tableFontSize -= 0.5;
        signatureMargin = Math.max(20, signatureMargin - 5);
        
        container.style.fontSize = `${fontSize}pt`;
        if (dataTable) {
            dataTable.style.fontSize = `${tableFontSize}pt`;
            dataTable.querySelectorAll('th, td').forEach(cell => {
                cell.style.padding = `${tablePadding}px`;
            });
        }
        signatureNameAll.forEach(el => el.style.marginTop = `${signatureMargin}px`);

        attempts++;
    }
}

// Gen Bảng Hàng Hóa
function generateItemsTable(totals) {
    let tbody = '';
    state.items.forEach((item, index) => {
        let thanhtien = item.qty * item.price;
        tbody += `
            <tr>
                <td class="center">${String(index + 1).padStart(2, '0')}</td>
                <td>${item.name}</td>
                <td class="center">${item.unit}</td>
                <td class="center">${item.qty}</td>
                <td class="num">${formatVND(item.price)}</td>
                <td class="num">${formatVND(thanhtien)}</td>
            </tr>
        `;
    });

    let vatRow = '';
    if (state.showVat) {
        vatRow = `
            <tr>
                <td colspan="5" class="text-bold">Tiền thuế GTGT ${state.vatPercent}%</td>
                <td class="num text-bold">${formatVND(totals.vat)}</td>
            </tr>
        `;
    }

    return `
        <table class="data-table">
            <thead>
                <tr>
                    <th width="5%">STT</th>
                    <th>TÊN HÀNG HÓA</th>
                    <th width="8%">ĐVT</th>
                    <th width="5%">SL</th>
                    <th width="15%">ĐƠN GIÁ<br>(VNĐ)</th>
                    <th width="18%">THÀNH TIỀN<br>(VNĐ)</th>
                </tr>
            </thead>
            <tbody>
                ${tbody}
                <tr>
                    <td colspan="5" class="text-bold">Cộng tiền hàng</td>
                    <td class="num text-bold">${formatVND(totals.subtotal)}</td>
                </tr>
                ${vatRow}
                <tr>
                    <td colspan="5" class="text-bold">Tổng tiền thanh toán</td>
                    <td class="num text-bold">${formatVND(totals.total)}</td>
                </tr>
                <tr>
                    <td colspan="6" class="text-italic text-bold">Số tiền viết bằng chữ: ${docTienBangChu(totals.total)}</td>
                </tr>
            </tbody>
        </table>
    `;
}

function generateOrder() {
    const totals = calculateTotals();
    
    return `
        <table class="header-table">
            <tr>
                <td width="20%" class="text-bold">Đơn vị bán hàng</td>
                <td width="80%">: <b>${state.companyName}</b></td>
            </tr>
            <tr>
                <td class="text-bold">Mã số thuế</td>
                <td>: ${state.companyTax}</td>
            </tr>
            <tr>
                <td class="text-bold">Tel</td>
                <td>: ${state.companyPhone}</td>
            </tr>
            <tr>
                <td class="text-bold">Địa chỉ</td>
                <td>: ${state.companyAddress}</td>
            </tr>
            <tr>
                <td class="text-bold">Số tài khoản</td>
                <td>: ${state.companyAccount} – Tại ${state.companyBank} – ${state.companyBranch}.</td>
            </tr>
        </table>

        <h1 class="title">ĐƠN ĐẶT HÀNG</h1>

        <table class="header-table" style="margin-bottom: 5px;">
            <tr>
                <td width="20%" class="text-bold">Khách hàng</td>
                <td width="80%">: <b>${state.customerName}</b></td>
            </tr>
            <tr>
                <td class="text-bold">Ngày</td>
                <td>: ${formatDateToVN(state.docDate)}</td>
            </tr>
            <tr>
                <td class="text-bold">Số điện thoại</td>
                <td>: ${state.customerPhone}</td>
            </tr>
            <tr>
                <td class="text-bold">Số CCCD</td>
                <td>: ${state.customerId}</td>
            </tr>
            <tr>
                <td class="text-bold">Địa chỉ theo CCCD</td>
                <td>: ${state.customerIdAddress || state.customerAddress}</td>
            </tr>
            <tr>
                <td class="text-bold">Email</td>
                <td>: ${state.customerEmail}</td>
            </tr>
        </table>

        ${generateItemsTable(totals)}

        <div style="margin-top: 15px; font-size: 11pt;" class="notes-section">
            <div class="text-bold text-decoration-underline" style="margin-bottom: 5px; text-decoration: underline;">Ghi chú:</div>
            - Thời gian giao hàng : ${state.deliveryTime || 'Theo thỏa thuận'}.<br>
            - Phương thức thanh toán : Thanh toán trước: <b>${formatVND(totals.deposit)} VNĐ</b> và thanh toán phần còn lại là: <b>${formatVND(totals.remain)} VNĐ</b> sau khi nhận đủ số lượng hàng hóa và hóa đơn GTGT.<br>
            - Số tài khoản thanh toán : <b>${state.companyAccount} ${state.companyRep}</b> – Tại ${state.companyBank}, ${state.companyBranch}.<br>
            - Địa điểm giao hàng : ${state.deliveryAddress || state.customerAddress}<br>
            <br>
            Trân trọng kính chào!
        </div>

        <div class="signature-section">
            <div class="signature-box">
                <div class="signature-title">Xác nhận của khách hàng</div>
                <div class="signature-note">(Ký, họ tên)</div>
                <div class="signature-name">${state.customerRep}</div>
            </div>
            <div class="signature-box">
                <div class="signature-title">Giám đốc</div>
                <div class="signature-note">(Ký, họ tên, đóng dấu)</div>
                <div class="signature-name">${state.companyRep}</div>
            </div>
        </div>
    `;
}

function generateQuote() {
    const totals = calculateTotals();
    const notes = state.docNote.trim() ? state.docNote.trim().split('\n').map(n => `- ${n}`).join('<br>') : '';
    
    return `
        <table class="header-table">
            <tr>
                <td width="20%" class="text-bold">Đơn vị bán hàng</td>
                <td width="80%">: <b>${state.companyName}</b></td>
            </tr>
            <tr>
                <td class="text-bold">Mã số thuế</td>
                <td>: ${state.companyTax}</td>
            </tr>
            <tr>
                <td class="text-bold">Tel</td>
                <td>: ${state.companyPhone}</td>
            </tr>
            <tr>
                <td class="text-bold">Địa chỉ</td>
                <td>: ${state.companyAddress}</td>
            </tr>
            <tr>
                <td class="text-bold">Số tài khoản</td>
                <td>: ${state.companyAccount} – Tại ${state.companyBank} – ${state.companyBranch}.</td>
            </tr>
        </table>

        <h1 class="title">BẢNG BÁO GIÁ</h1>

        <table class="header-table" style="margin-bottom: 5px;">
            <tr>
                <td width="20%" class="text-bold">Kính gửi</td>
                <td width="80%">: <b>${state.customerName}</b></td>
            </tr>
            <tr>
                <td class="text-bold">Ngày</td>
                <td>: ${formatDateToVN(state.docDate)}</td>
            </tr>
            <tr>
                <td class="text-bold">Mã số thuế</td>
                <td>: ${state.customerTax}</td>
            </tr>
            <tr>
                <td class="text-bold">Địa chỉ</td>
                <td>: ${state.customerAddress}</td>
            </tr>
            <tr>
                <td class="text-bold">Email</td>
                <td>: ${state.customerEmail}</td>
            </tr>
        </table>

        ${generateItemsTable(totals)}

        <div style="margin-top: 15px;">
            <div class="text-bold text-decoration-underline" style="margin-bottom: 5px; text-decoration: underline;">Ghi chú:</div>
            - Đơn giá đã bao gồm phí in ấn và giao hàng.<br>
            ${notes ? notes + '<br>' : ''}
            - Thời gian giao hàng : ${state.deliveryTime || 'Theo thỏa thuận'}.<br>
            - Phương thức thanh toán : Thanh toán trước: <b>${formatVND(totals.deposit)} VNĐ</b> và thanh toán phần còn lại là: <b>${formatVND(totals.remain)} VNĐ</b> sau khi nhận đủ số lượng hàng hóa và hóa đơn GTGT.<br>
            <br>
            Trân trọng kính chào!
        </div>

        <div class="signature-section">
            <div class="signature-box">
                <div class="signature-title">Xác nhận của khách hàng</div>
                <div class="signature-note">(Ký, họ tên)</div>
                <div class="signature-name">${state.customerRep}</div>
            </div>
            <div class="signature-box">
                <div class="signature-title">Giám đốc</div>
                <div class="signature-note">(Ký, họ tên, đóng dấu)</div>
                <div class="signature-name">${state.companyRep}</div>
            </div>
        </div>
    `;
}

function generateContract() {
    const totals = calculateTotals();
    
    return `
        <div class="contract-header">
            <p>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p>Độc lập - Tự do - Hạnh phúc</p>
            <p>------oOo------</p>
            <h1 class="title" style="margin: 10px 0;">HỢP ĐỒNG KINH TẾ</h1>
            <p style="text-decoration: underline;">Số: ${state.contractNo}</p>
            <p style="text-decoration: underline;">Về việc: Cung cấp hàng hóa</p>
        </div>

        <div class="contract-content">
            <div class="contract-section party-info">
                <p>- Căn cứ Luật Thương Mại số 36/2005/QH11 ngày 14/06/2005 của Quốc Hội, có hiệu lực từ ngày 01/07/2006.</p>
                <p>- Căn cứ vào chức năng, nhiệm vụ, khả năng cung ứng và nhu cầu của 2 bên.</p>
                <p style="font-style: italic;">Hôm nay, ${formatDateToText(state.contractDate)}, đại diện hai bên ký Hợp đồng mua bán gồm:</p>
                
                <p class="text-bold" style="margin-top: 10px;">BÊN MUA (BÊN A): ${state.customerName}</p>
                <table class="header-table" style="margin-bottom: 5px;">
                    <tr>
                        <td width="20%">Do Ông/Bà</td>
                        <td width="40%">: <b>${state.customerRep}</b></td>
                        <td width="40%">Chức vụ: <b>${state.customerRole}</b></td>
                    </tr>
                    <tr>
                        <td>Địa chỉ</td>
                        <td colspan="2">: ${state.customerAddress}</td>
                    </tr>
                    <tr>
                        <td>Mã số thuế</td>
                        <td colspan="2">: ${state.customerTax}</td>
                    </tr>
                    <tr>
                        <td>Điện thoại</td>
                        <td colspan="2">: ${state.customerPhone}</td>
                    </tr>
                </table>

                <p class="text-bold" style="margin-top: 10px;">BÊN BÁN (BÊN B): ${state.companyName}</p>
                <table class="header-table" style="margin-bottom: 5px;">
                    <tr>
                        <td width="20%">Do Ông/Bà</td>
                        <td width="40%">: <b>${state.companyRep}</b></td>
                        <td width="40%">Chức vụ: <b>${state.companyRepRole}</b></td>
                    </tr>
                    <tr>
                        <td>Địa chỉ</td>
                        <td colspan="2">: ${state.companyAddress}</td>
                    </tr>
                    <tr>
                        <td>Mã số thuế</td>
                        <td colspan="2">: ${state.companyTax}</td>
                    </tr>
                    <tr>
                        <td>Điện thoại</td>
                        <td colspan="2">: ${state.companyPhone}</td>
                    </tr>
                    <tr>
                        <td>Tài khoản số</td>
                        <td colspan="2">: ${state.companyAccount} – ${state.companyName}, ${state.companyBank}, ${state.companyBranch}.</td>
                    </tr>
                </table>

                <p>Hai bên thống nhất thỏa thuận nội dung hợp đồng sau:</p>
            </div>

            <section class="contract-article">
                <div class="contract-article-title article-title text-bold text-decoration-underline" style="margin-top: 15px; margin-bottom: 5px;">ĐIỀU 1: NỘI DUNG VÀ GIÁ TRỊ HỢP ĐỒNG</div>
                <p>1.1/ Bên B cung cấp cho bên A số lượng hàng hóa chi tiết như sau:</p>
                
                ${generateItemsTable(totals)}

                <div class="total-section">
                    <p class="text-bold" style="margin-top: 10px;">+ TỔNG GIÁ TRỊ ĐƠN HÀNG = ${formatVND(totals.total)} VNĐ</p>
                    <p class="text-italic">(${docTienBangChu(totals.total)})</p>
                </div>
            </section>

            <section class="contract-article">
                <div class="contract-article-title article-title text-bold text-decoration-underline" style="margin-top: 15px; margin-bottom: 5px;">ĐIỀU 2: PHƯƠNG THỨC GIAO NHẬN VÀ VẬN CHUYỂN</div>
                <p>- Địa điểm giao: ${state.deliveryAddress || state.customerAddress}</p>
                <p>- Phương tiện và chi phí vận chuyển: Bên B chịu trách nhiệm giao hàng tới địa điểm bên A chỉ định.</p>
                <p>- Thời gian giao hàng: ${state.deliveryTime || 'Theo thỏa thuận của hai bên'}.</p>
            </section>

            <section class="contract-article payment-section">
                <div class="contract-article-title article-title text-bold text-decoration-underline" style="margin-top: 15px; margin-bottom: 5px;">ĐIỀU 3: PHƯƠNG THỨC THANH TOÁN</div>
                <p>- Bên A thanh toán trước: <b>${formatVND(totals.deposit)} VNĐ</b> (${docTienBangChu(totals.deposit)}) và thanh toán phần còn lại cho bên B với số tiền là: <b>${formatVND(totals.remain)} VNĐ</b> (${docTienBangChu(totals.remain)}) sau khi nhận đủ số lượng hàng hóa và hóa đơn GTGT.</p>
                <p>- Chuyển khoản trực tiếp vào STK: <b>${state.companyAccount} – ${state.companyName}</b>, ${state.companyBank} - ${state.companyBranch}.</p>
            </section>

            <section class="contract-article">
                <div class="contract-article-title article-title text-bold text-decoration-underline" style="margin-top: 15px; margin-bottom: 5px;">ĐIỀU 4: TRÁCH NHIỆM CỦA MỖI BÊN</div>
                <p class="text-bold">4.1 Trách nhiệm bên B</p>
                <p>- Bên B sẽ thực hiện mẫu do bên A duyệt, căn cứ vào mẫu đã duyệt để tiến hành sản xuất hàng loạt và làm đối chứng để kiểm tra hàng nhập kho.</p>
                <p>- Giao hàng cho Bên A đúng chất lượng, đúng thời gian, địa điểm đã thống nhất.</p>
                <p>- Nếu sản phẩm bị lỗi, Bên B có trách nhiệm sửa hoặc may mới trong vòng 10 - 15 ngày kể từ ngày nhận sản phẩm lỗi, Bên B chịu toàn bộ chi phí phát sinh.</p>

                <p class="text-bold" style="margin-top: 10px;">4.2 Trách nhiệm bên A</p>
                <p>- Phối hợp cùng bên B giải quyết các vấn đề phát sinh trong suốt quá trình thực hiện hợp đồng.</p>
                <p>- Cùng bên B lập biên bản nghiệm thu và bàn giao nhận hàng.</p>
                <p>- Thanh toán đầy đủ và đúng thời gian cho Bên B.</p>
            </section>

            <section class="contract-article">
                <div class="contract-article-title article-title text-bold text-decoration-underline" style="margin-top: 15px; margin-bottom: 5px;">ĐIỀU 5: TRÁCH NHIỆM THỰC HIỆN HỢP ĐỒNG</div>
                <p>- Hai bên cam kết thực hiện đầy đủ nghĩa vụ của mình đã nêu trong hợp đồng, không đơn phương thay đổi hoặc hủy bỏ hợp đồng.</p>
                <p>- Nếu một trong hai bên đơn phương chấm dứt hợp đồng thì bên đó phải chịu hoàn toàn các chi phí phát sinh liên quan và các thiệt hại do việc đơn phương chấm dứt hợp đồng gây ra.</p>
            </section>

            <div class="contract-section signature-section" style="margin-top: 30px;">
                <div class="signature-box">
                    <div class="signature-title">ĐẠI DIỆN BÊN A</div>
                    <div class="signature-name" style="margin-top: 100px;">${state.customerRep}</div>
                </div>
                <div class="signature-box">
                    <div class="signature-title">ĐẠI DIỆN BÊN B</div>
                    <div class="signature-name" style="margin-top: 100px;">${state.companyRep}</div>
                </div>
            </div>
        </div>
    `;
}
