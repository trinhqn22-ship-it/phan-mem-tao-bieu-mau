// js/parser.js

function parseAIResponse(jsonString) {
    console.log("[Parser] Bắt đầu parse JSON:", jsonString);
    try {
        let cleanString = jsonString.trim();
        
        // Cắt lấy đoạn JSON từ dấu ngoặc nhọn đầu tiên đến dấu ngoặc nhọn cuối cùng
        const startIndex = cleanString.indexOf('{');
        const endIndex = cleanString.lastIndexOf('}');
        
        if (startIndex !== -1 && endIndex !== -1) {
            cleanString = cleanString.substring(startIndex, endIndex + 1);
        }

        const data = JSON.parse(cleanString);
        console.log("[Parser] Parse thành công:", data);
        return data;
    } catch (e) {
        console.error("[Parser] Parse JSON thất bại", e);
        throw new Error("Không thể parse JSON từ AI. Dữ liệu trả về bị lỗi định dạng.");
    }
}
