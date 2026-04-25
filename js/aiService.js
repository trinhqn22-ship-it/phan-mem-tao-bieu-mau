// js/aiService.js

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
- Ví dụ: "50 áo polo 120k", "42 bộ đồ bảo hộ giá 210k"
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

FORMAT JSON TRẢ VỀ (Chỉ trả JSON, không giải thích, không markdown):
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

async function analyzeWithAI(text, apiKey, model) {
    if (!apiKey) throw new Error("Vui lòng nhập API Key OpenAI.");
    if (!text) throw new Error("Vui lòng nhập nội dung chat.");

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

    console.log("[AI Service] Sending request to model:", model);

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
        throw new Error(err.error?.message || "Lỗi khi gọi API.");
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

function initAI() {
    const btnAnalyze = document.getElementById('btn-analyze-ai');
    const btnFill = document.getElementById('btn-fill-form');
    const loading = document.getElementById('ai-loading');
    const resultSection = document.getElementById('ai-result-section');
    const outputJson = document.getElementById('aiOutputJson');
    const apiKeyInput = document.getElementById('aiApiKey');

    // Khôi phục API key từ localStorage
    const savedApiKey = localStorage.getItem('aiApiKey');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }

    apiKeyInput.addEventListener('change', (e) => {
        localStorage.setItem('aiApiKey', e.target.value);
    });

    btnAnalyze.addEventListener('click', () => {
        clearTimeout(aiDebounceTimer);
        aiDebounceTimer = setTimeout(async () => {
            const text = document.getElementById('aiInputText').value.trim();
            const apiKey = apiKeyInput.value.trim();
            const model = document.getElementById('aiModel').value;

            if (!text) {
                alert('Vui lòng nhập đoạn chat!');
                return;
            }

            if (!apiKey) {
                alert('Vui lòng nhập OpenAI API Key để sử dụng tính năng này!');
                return;
            }

            loading.style.display = 'block';
            resultSection.style.display = 'none';
            btnAnalyze.disabled = true;

            try {
                const result = await analyzeWithAI(text, apiKey, model);
                console.log("[AI Service] Response received:", result);
                
                outputJson.value = result; // Raw JSON
                resultSection.style.display = 'block';
            } catch (err) {
                console.error("[AI Service] Error:", err);
                alert("Lỗi AI: " + err.message);
            } finally {
                loading.style.display = 'none';
                btnAnalyze.disabled = false;
            }
        }, 500); // Debounce 500ms
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
