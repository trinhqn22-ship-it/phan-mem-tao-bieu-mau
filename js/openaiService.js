// js/openaiService.js

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
- nhận dạng ngày tháng yyyy-mm-dd

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
  "document": {
    "date": "",
    "contractNo": ""
  }
}`;

let aiDebounceTimer;

const OpenAIService = {
    async testConnection(apiKey) {
        const url = "https://api.openai.com/v1/models";
        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`
                }
            });
            if (response.status === 401 || response.status === 403) {
                return { success: false, message: "API Key không hợp lệ hoặc bị từ chối." };
            }
            if (!response.ok) {
                return { success: false, message: "Lỗi kết nối từ phía server OpenAI." };
            }
            return { success: true, message: "Kết nối thành công!" };
        } catch (error) {
            return { success: false, message: "Không kết nối được mạng hoặc API." };
        }
    },

    async callOpenAI(text, apiKey, model) {
        const url = "https://api.openai.com/v1/chat/completions";
        const body = {
            model: model,
            messages: [
                { role: "system", content: AI_PROMPT },
                { role: "user", content: text }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
        };

        const masked = KeyManager.maskKey(apiKey);
        console.log(`[OpenAI] Sending request to ${model} with key: ${masked}`);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Lỗi khi gọi API OpenAI.");
        }

        const data = await response.json();
        return data.choices[0].message.content;
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
    const resultSection = document.getElementById('ai-result-section');
    const outputJson = document.getElementById('aiOutputJson');

    // Load API Key
    const existingKey = KeyManager.loadKey();
    if (existingKey) {
        inputKey.value = existingKey;
        setStatusText('Đã lưu API Key cục bộ', 'green');
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
        
        const result = await OpenAIService.testConnection(val);
        btnTestKey.disabled = false;
        btnTestKey.textContent = "Kiểm tra kết nối";

        alert(result.message);
        if (result.success) {
            setStatusText('Kết nối thành công', 'green');
        } else {
            setStatusText('API Key không hợp lệ', 'red');
        }
    });

    // Analyze Chat
    btnAnalyze.addEventListener('click', () => {
        clearTimeout(aiDebounceTimer);
        aiDebounceTimer = setTimeout(async () => {
            const text = document.getElementById('aiInputText').value.trim();
            const apiKey = KeyManager.loadKey() || inputKey.value.trim();
            const model = selectModel.value;

            if (!apiKey) {
                alert('Bạn chưa cấu hình OpenAI API Key! Vui lòng lưu API Key trước khi sử dụng.');
                return;
            }

            if (!text) {
                alert('Vui lòng nhập đoạn chat!');
                return;
            }

            loading.style.display = 'block';
            resultSection.style.display = 'none';
            btnAnalyze.disabled = true;

            try {
                const result = await OpenAIService.callOpenAI(text, apiKey, model);
                outputJson.value = result;
                resultSection.style.display = 'block';
            } catch (err) {
                console.error("[AI Service Error]", err.message);
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
