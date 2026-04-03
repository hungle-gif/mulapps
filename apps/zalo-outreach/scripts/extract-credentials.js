// ============================================
// Paste đoạn code này vào Console (F12) trên chat.zalo.me
// sau khi đã đăng nhập Zalo Web
// ============================================

(function() {
  const imei = localStorage.getItem('z_uuid') || localStorage.getItem('ZPK_IMEI');
  const ua = navigator.userAgent;

  // Get cookies
  const cookie = document.cookie;

  const data = {
    imei: imei,
    user_agent: ua,
    cookie: cookie
  };

  console.log('=== ZALO CREDENTIALS ===');
  console.log('IMEI:', imei);
  console.log('User-Agent:', ua);
  console.log('Cookie:', cookie);
  console.log('');
  console.log('=== COPY JSON NÀY ===');
  console.log(JSON.stringify(data, null, 2));

  // Copy to clipboard
  navigator.clipboard.writeText(JSON.stringify(data)).then(() => {
    console.log('✅ Đã copy vào clipboard!');
  }).catch(() => {
    console.log('⚠ Không copy được, hãy copy JSON ở trên thủ công');
  });

  return data;
})();
