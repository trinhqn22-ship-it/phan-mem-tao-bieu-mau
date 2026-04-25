// js/geminiService.js

const AI_PROMPT = `Bạn là hệ thống AI chuyên phân tích nội dung đơn hàng, báo giá và hợp đồng bằng tiếng Việt.

Nhiệm vụ:
- Đọc đoạn văn bản người dùng nhập (có thể là chat Zalo, Facebook, ghi chú tự nhiên)
- Trích xuất thông tin chính xác thành JSON
- Không được suy đoán nếu không có dữ liệu
- Nếu thiếu thì để null

QUY TẮC:
1. Khách hàng:
- "công ty", "khách", "bên A" → customer.name
- "ông", "bà", "đại diện" → customer.representative
- "giám đốc", "chức vụ" → customer.position
- "mst", "mã số thuế" → customer.tax
- "sđt", "đt", "điện thoại" → customer.phone
- "mail", "email" → customer.email
- "địa chỉ", "ở" → customer.address

2. Hàng hóa:
- Nhận diện câu có số lượng + giá
- Chuẩn hóa unit: bộ / cái / áo / đôi (nếu không có đơn vị → mặc định "cái")

3. Giá:
- 120k → 120000
- 3 triệu → 3000000
- 1.5 triệu → 1500000

4. VAT:
- "vat 8%" → 8
- nếu không có → 0

5. Tiền cọc:
- "cọc 50%" → depositPercent (50)
- "cọc 5 triệu" → depositAmount (5000000)

6. Ngày:
- nhận dạng ngày tháng định dạng yyyy-mm-dd (LƯU Ý: Năm hiện tại là ${new Date().getFullYear()}, nếu khách không ghi năm thì tự động lấy năm hiện tại).

7. Giao hàng (Thời gian & Địa điểm):
Quy tắc tách thông tin giao hàng:
Nếu trong đoạn chat có câu dạng "giao hàng tại...", "giao ngày... tại...", "ngày... giao hàng tại...", "ship ngày... ở..." thì phải tách thành:
- delivery.time: phần nói về thời gian/ngày giao
- delivery.address: phần nói về nơi giao sau từ 'tại' hoặc 'ở'
Không gộp chung toàn bộ câu vào ghi chú (note).
FORMAT JSON TRẢ VỀ (Chỉ trả JSON, không giải thích):
{
  "customer": {
    "name": "",
    "representative": "",
    "position": "",
    "tax": "",
    "phone": "",
    "email": "",
    "address": ""
  },
  "items": [
    {
      "name": "",
      "unit": "",
      "qty": 0,
      "price": 0
    }
  ],
  "vatPercent": 0,
  "depositPercent": null,
  "depositAmount": null,
  "delivery": {
    "time": null,
    "address": null
  },
  "document": {
    "date": "",
    "contractNo": "",
    "note": ""
  }
}`;

let aiDebounceTimer;

const GeminiService = {
    async testConnection(apiKey) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        try {
            const response = await fetch(url, {
                method: "GET"
            });
            if (response.status === 400 || response.status === 401 || response.status === 403) {
                return { success: false, message: "API Key không hợp lệ hoặc bị từ chối." };
            }
            if (!response.ok) {
                const err = await response.json();
                return { success: false, message: err.error?.message || "Lỗi kết nối từ phía server Gemini." };
            }
            const data = await response.json();
            const validModels = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
            return { success: true, message: "Kết nối thành công!", models: validModels };
        } catch (error) {
            return { success: false, message: "Không kết nối được mạng hoặc API." };
        }
    },

    async callGemini(text, apiKey, model) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const body = {
            system_instruction: {
                parts: [{ text: AI_PROMPT }]
            },
            contents: [
                {
                    parts: [{ text: text }]
                }
            ],
            generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json"
            }
        };

        const masked = KeyManager.maskKey(apiKey);
        console.log(`[Gemini] Sending request to ${model} with key: ${masked}`);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Lỗi khi gọi API Gemini.");
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error("Không nhận được phản hồi hợp lệ từ Gemini.");
        }
    }
};

function setStatusText(status, color) {
    const statusSpan = document.querySelector('#key-status-text span');
    if (statusSpan) {
        statusSpan.textContent = status;
        statusSpan.style.color = color;
    }
}

function initAI() {
    const inputKey = document.getElementById('aiApiKey');
    const btnToggle = document.getElementById('btn-toggle-key');
    const btnSaveKey = document.getElementById('btn-save-key');
    const btnTestKey = document.getElementById('btn-test-key');
    const btnDelKey = document.getElementById('btn-delete-key');
    const selectModel = document.getElementById('aiModel');

    // UI AI Analysis
    const btnAnalyze = document.getElementById('btn-analyze-ai');
    const btnFill = document.getElementById('btn-fill-form');
    const loading = document.getElementById('ai-loading');
    const outputJson = document.getElementById('aiOutputJson');

    // Load API Key
    const existingKey = KeyManager.loadKey();
    if (existingKey) {
        inputKey.value = existingKey;
        setStatusText('Đang kiểm tra kết nối...', 'orange');
        
        // Tự động kiểm tra kết nối khi có sẵn key
        GeminiService.testConnection(existingKey).then(result => {
            if (result.success) {
                setStatusText('Kết nối thành công', 'green');
                populateModels(result.models);
            } else {
                setStatusText('API Key không hợp lệ', 'red');
            }
        });
    } else {
        setStatusText('Chưa cấu hình API Key', 'red');
    }

    // Load Model config
    const savedModel = localStorage.getItem('ai_selected_model');
    if (savedModel) {
        selectModel.value = savedModel;
    }

    selectModel.addEventListener('change', (e) => {
        localStorage.setItem('ai_selected_model', e.target.value);
    });

    // Toggle Visibility
    btnToggle.addEventListener('click', () => {
        if (inputKey.type === 'password') {
            inputKey.type = 'text';
            btnToggle.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
        } else {
            inputKey.type = 'password';
            btnToggle.innerHTML = '<i class="fa-solid fa-eye"></i>';
        }
    });

    // Save Key
    btnSaveKey.addEventListener('click', () => {
        const val = inputKey.value.trim();
        try {
            KeyManager.saveKey(val);
            alert("Lưu API Key thành công!");
            setStatusText('Đã lưu API Key cục bộ', 'green');
        } catch (e) {
            alert("Lỗi: " + e.message);
            setStatusText('API Key không hợp lệ', 'red');
        }
    });

    // Delete Key
    btnDelKey.addEventListener('click', () => {
        if(confirm("Bạn có chắc chắn muốn xóa API Key khỏi máy này?")) {
            KeyManager.removeKey();
            inputKey.value = "";
            alert("Đã xóa API Key!");
            setStatusText('Chưa cấu hình API Key', 'red');
        }
    });

    // Test Key
    btnTestKey.addEventListener('click', async () => {
        const val = inputKey.value.trim() || KeyManager.loadKey();
        if (!val) {
            alert("Vui lòng nhập API Key để kiểm tra!");
            return;
        }
        btnTestKey.disabled = true;
        btnTestKey.textContent = "Đang kiểm tra...";
        
        const result = await GeminiService.testConnection(val);
        btnTestKey.disabled = false;
        btnTestKey.textContent = "Kiểm tra kết nối";

        if (result.success) {
            alert(result.message);
            setStatusText('Kết nối thành công', 'green');
            populateModels(result.models);
        } else {
            alert(result.message);
            setStatusText('API Key không hợp lệ', 'red');
        }
    });

    function populateModels(models) {
        if (!models || models.length === 0) return;
        const savedModel = localStorage.getItem('ai_selected_model');
        selectModel.innerHTML = '';
        models.forEach(m => {
            const option = document.createElement('option');
            let val = m.name.replace('models/', '');
            option.value = val;
            option.textContent = m.displayName || val;
            selectModel.appendChild(option);
        });
        
        // Cố gắng chọn model đã lưu hoặc ưu tiên gemini-2.5-flash
        if (savedModel && Array.from(selectModel.options).some(o => o.value === savedModel)) {
            selectModel.value = savedModel;
        } else {
            const defaultModel = Array.from(selectModel.options).find(o => o.value.includes('gemini-2.5-flash')) || selectModel.options[0];
            if (defaultModel) selectModel.value = defaultModel.value;
        }
    }

    // Analyze Chat
    btnAnalyze.addEventListener('click', () => {
        clearTimeout(aiDebounceTimer);
        aiDebounceTimer = setTimeout(async () => {
            const text = document.getElementById('aiInputText').value.trim();
            const apiKey = KeyManager.loadKey() || inputKey.value.trim();
            const model = selectModel.value;

            if (!apiKey) {
                alert('Bạn chưa cấu hình Gemini API Key! Vui lòng lưu API Key trước khi sử dụng.');
                return;
            }

            if (!text) {
                alert('Vui lòng nhập đoạn chat!');
                return;
            }

            loading.style.display = 'block';
            btnAnalyze.disabled = true;
            btnFill.disabled = true; // Vô hiệu hóa nút điền cho đến khi phân tích xong
            btnFill.classList.remove('btn-success');
            btnFill.classList.add('btn-secondary');

            try {
                const result = await GeminiService.callGemini(text, apiKey, model);
                outputJson.value = result;
                btnFill.disabled = false; // Bật sáng nút điền vào biểu mẫu
                btnFill.classList.remove('btn-secondary');
                btnFill.classList.add('btn-success');
            } catch (err) {
                console.error("[Gemini Service Error]", err.message);
                alert("Lỗi AI: " + err.message);
            } finally {
                loading.style.display = 'none';
                btnAnalyze.disabled = false;
            }
        }, 500);
    });

    btnFill.addEventListener('click', () => {
        const rawJson = outputJson.value;
        try {
            const parsedData = parseAIResponse(rawJson);
            if (!parsedData.items || parsedData.items.length === 0) {
                alert("Không nhận diện được sản phẩm nào trong đoạn chat!");
            }
            mapAIToState(parsedData);
            alert("Điền dữ liệu thành công!");
        } catch (e) {
            console.error(e);
            alert(e.message);
        }
    });
}
