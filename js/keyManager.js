// js/keyManager.js

const KeyManager = {
    KEY_NAME: 'gemini_api_key',
    SHEET_URL_KEY: 'google_sheet_webhook_url',

    saveKey(key) {
        if (!key) throw new Error("API Key không được rỗng");
        if (!key.startsWith("AIza")) throw new Error("API Key của Gemini thường bắt đầu bằng 'AIza'");
        localStorage.setItem(this.KEY_NAME, key.trim());
    },

    loadKey() {
        return localStorage.getItem(this.KEY_NAME) || "";
    },

    removeKey() {
        localStorage.removeItem(this.KEY_NAME);
    },

    saveSheetUrl(url) {
        if (!url) throw new Error("URL không được rỗng");
        if (!url.startsWith("https://script.google.com/macros/s/")) throw new Error("URL phải là đường dẫn Google Apps Script hợp lệ.");
        localStorage.setItem(this.SHEET_URL_KEY, url.trim());
    },

    loadSheetUrl() {
        return localStorage.getItem(this.SHEET_URL_KEY) || "https://script.google.com/macros/s/AKfycbzakD0Am2xSvrU4Adeq2V02khyG1yqS3a9XPS5rvKIkU_2cjvNJRf9ZA-rEtKLonrwEJA/exec";
    },

    removeSheetUrl() {
        localStorage.removeItem(this.SHEET_URL_KEY);
    },

    maskKey(key) {
        if (!key || key.length < 10) return "Chưa có Key";
        return key.substring(0, 7) + "..." + key.substring(key.length - 4);
    }
};
