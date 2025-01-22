// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyAI-KtaTqmmxXQm0XRgRu9GIsVmWaJTTDI",
  authDomain: "carcular-c2b26.firebaseapp.com",
  projectId: "carcular-c2b26",
  storageBucket: "carcular-c2b26.firebasestorage.app",
  messagingSenderId: "159197763518",
  appId: "1:159197763518:web:599c178c8b25d255e9cbef",
  measurementId: "G-YBWK7K8L5E"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);

// Firestore 데이터베이스 참조 생성 및 전역 변수로 내보내기
const db = firebase.firestore();
window.db = db;  // 전역 스코프에서 db 사용 가능하도록 설정
