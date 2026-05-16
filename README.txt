exam2026 多題庫＋圖片/影片題支援版

上傳 GitHub Pages 時，請把本資料夾裡的所有檔案與資料夾一起上傳：

index.html
style.css
app.js
banks.js
images/
videos/

影片題寫法：

{
  type: "single",
  question: "看到影片中的情況應如何處置？",
  video: "videos/q001.mp4",
  answer: "2",
  options: [
    "立即加速通過",
    "減速並注意行人",
    "按喇叭提醒後通過"
  ]
}

也支援 webm/ogg，通常 mp4 最適合手機瀏覽器。

如果要用 YouTube 嵌入，格式如下：

{
  type: "single",
  question: "看到影片中的情況應如何處置？",
  youtube: "https://www.youtube.com/embed/影片ID",
  answer: "2",
  options: ["選項一", "選項二", "選項三"]
}

注意：
1. UI 沒有改版，只增加影片題能力。
2. 目前 banks.js 內的機車題庫仍以文字題與圖片題為主。
3. 之後只要把官方影片檔放進 videos/，再於對應題目加 video 欄位即可。
4. GitHub Pages 可以放影片，但單檔太大時載入會比較慢，建議 MP4 壓到合理大小。
