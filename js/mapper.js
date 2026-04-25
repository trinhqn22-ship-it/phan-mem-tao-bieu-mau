// js/mapper.js

function mapAIToState(aiData) {
    console.log("[Mapper] Bắt đầu map dữ liệu vào state");

    // Map Thông tin khách hàng
    if (aiData.customer) {
        if (aiData.customer.name) state.customerName = aiData.customer.name;
        if (aiData.customer.representative) state.customerRep = aiData.customer.representative;
        if (aiData.customer.position) state.customerRole = aiData.customer.position;
        if (aiData.customer.tax) state.customerTax = aiData.customer.tax;
        if (aiData.customer.phone) state.customerPhone = aiData.customer.phone;
        if (aiData.customer.email) state.customerEmail = aiData.customer.email;
        if (aiData.customer.address) state.customerAddress = aiData.customer.address;
    }

    // Map Thông tin chứng từ (Ngày, Số HĐ...)
    if (aiData.document && aiData.document.date) {
        state.docDate = aiData.document.date;
        state.contractDate = aiData.document.date;
    } else {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;
        state.docDate = todayStr;
        state.contractDate = todayStr;
    }

    if (aiData.document) {
        if (aiData.document.contractNo) state.contractNo = aiData.document.contractNo;
        if (aiData.document.note) state.docNote = aiData.document.note;
    }

    // Map Giao hàng
    if (aiData.delivery) {
        if (aiData.delivery.time) state.deliveryTime = aiData.delivery.time;
        if (aiData.delivery.address) state.deliveryAddress = aiData.delivery.address;
    }

    // Map Cài đặt VAT
    if (aiData.vatPercent !== null && aiData.vatPercent !== undefined) {
        state.showVat = aiData.vatPercent > 0;
        if (aiData.vatPercent > 0) {
            state.vatPercent = aiData.vatPercent;
        }
    }

    // Map Cài đặt Tiền cọc
    if (aiData.depositPercent !== null && aiData.depositPercent !== undefined) {
        state.depositPercent = aiData.depositPercent;
    }

    // Nếu có cọc tiền cứng (Vd: cọc 5 triệu)
    if (aiData.depositAmount && !aiData.depositPercent) {
        state.depositAmountFixed = aiData.depositAmount;
    } else {
        state.depositAmountFixed = null;
    }

    // Map Danh sách hàng hóa
    if (aiData.items && Array.isArray(aiData.items) && aiData.items.length > 0) {
        state.items = []; // Xóa hàng hóa cũ, fill hàng mới
        aiData.items.forEach((item, idx) => {
            state.items.push({
                name: item.name || `Sản phẩm ${idx + 1}`,
                desc: "",
                unit: item.unit || "Cái",
                qty: parseFloat(item.qty) || 1,
                price: parseFloat(item.price) || 0
            });
        });
    }

    // Đồng bộ ngược lại vào giao diện DOM (các ô Input)
    const inputs = Object.keys(state).filter(k => k !== 'items');
    inputs.forEach(key => {
        const el = document.getElementById(key);
        if (el) {
            if (el.type === 'checkbox') {
                el.checked = !!state[key];
            } else {
                el.value = state[key] !== undefined && state[key] !== null ? state[key] : "";
            }
        }
    });

    // Render lại bảng hàng hóa và khung Preview bên phải
    renderItemsForm();
    updatePreview();
    
    console.log("[Mapper] Đã map xong dữ liệu!");
}
