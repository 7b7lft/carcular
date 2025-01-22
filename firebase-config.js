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

// Firebase 초기화 함수
function initFirebase() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        window.db = firebase.firestore();
        console.log('Firebase 초기화 성공');
        return true;
    } catch (error) {
        console.error('Firebase 초기화 오류:', error);
        return false;
    }
}

// Firebase 초기화 실행
initFirebase();
