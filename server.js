const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// تهيئة السيرفر بصلاحياتك
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://story-97cf7-default-rtdb.firebaseio.com"
});

const db = admin.database();

// تحديد وقت بدء التشغيل حتى لا نرسل إشعارات بالرسائل القديمة
const serverStartTime = Date.now();
console.log("السيرفر قيد التشغيل... في انتظار الرسائل الجديدة");

// مراقبة مسار الرسائل
db.ref('messages')
  .orderByChild('timestamp')
  .startAt(serverStartTime)
  .on('child_added', async (snapshot) => {
      
      const messageData = snapshot.val();
      console.log(`رسالة جديدة من ${messageData.sender}: ${messageData.text}`);

      try {
          // جلب كل التوكنز
          const tokensSnapshot = await db.ref('tokens').once('value');
          const tokens = Object.keys(tokensSnapshot.val() || {});

          if (tokens.length === 0) return;

          // استبعاد توكن المرسل
          const targetTokens = tokens.filter(token => token !== messageData.senderToken);

          if (targetTokens.length > 0) {
              const payload = {
                  notification: {
                      title: `رسالة جديدة من ${messageData.sender}`,
                      body: messageData.text
                  },
                  tokens: targetTokens
              };

              // إرسال الإشعارات
              const response = await admin.messaging().sendEachForMulticast(payload);
              console.log(`تم الإرسال - نجاح: ${response.successCount}, فشل: ${response.failureCount}`);
              
              // تنظيف التوكنز القديمة أو غير الصالحة (اختياري)
              response.responses.forEach((res, idx) => {
                  if (!res.success) {
                      db.ref(`tokens/${targetTokens[idx]}`).remove();
                  }
              });
          }
      } catch (error) {
          console.error("حدث خطأ أثناء الإرسال:", error);
      }
});

// هذا السيرفر الوهمي ضروري لكي يعمل المشروع على Render بدون أخطاء بورتات
const http = require('http');
http.createServer((req, res) => {
    res.write("Chat Notification Server is Running!");
    res.end();
}).listen(process.env.PORT || 3000);
