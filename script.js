// Firebase 초기화
const firebaseConfig = {
    apiKey: "AIzaSyAI-KtaTqmmxXQm0XRgRu9GIsVmWaJTTDI",
    authDomain: "carcular-c2b26.firebaseapp.com",
    projectId: "carcular-c2b26",
    storageBucket: "carcular-c2b26.firebasestorage.app",
    messagingSenderId: "159197763518",
    appId: "1:159197763518:web:599c178c8b25d255e9cbef",
    measurementId: "G-YBWK7K8L5E"
};

// Firebase 초기화 및 설정
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// Storage 설정
const storageRef = storage.ref();

let transactions = [];
let editingId = null; // 현재 수정 중인 항목의 ID를 저장

// Firestore에서 데이터 가져오기
async function loadTransactions() {
    const snapshot = await db.collection('transactions').get();
    transactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
    updateUI();
}

// 영수증 이미지 업로드
async function uploadReceipt(file) {
    if (!file) return null;
    
    const timestamp = Date.now();
    const storageRef = storage.ref();
    const fileRef = storageRef.child(`receipts/${timestamp}_${file.name}`);
    
    try {
        // 파일을 Blob으로 변환하여 업로드
        const response = await fetch(URL.createObjectURL(file));
        const blob = await response.blob();
        
        // 메타데이터 설정
        const metadata = {
            contentType: file.type,
            customMetadata: {
                'Access-Control-Allow-Origin': '*'
            }
        };

        // 파일 업로드
        await fileRef.put(blob, metadata);
        const downloadURL = await fileRef.getDownloadURL();
        return downloadURL;
    } catch (error) {
        console.error("영수증 업로드 중 오류 발생:", error);
        throw error;
    }
}

// 수정 모드로 전환
async function editTransaction(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    // 폼 필드에 데이터 채우기
    document.getElementById('date').value = transaction.date;
    document.getElementById('type').value = transaction.type;
    document.getElementById('description').value = transaction.description;
    document.getElementById('amount').value = transaction.amount;
    
    // UI 업데이트
    document.getElementById('formTitle').textContent = '항목 수정';
    document.getElementById('submitBtn').textContent = '수정';
    document.getElementById('cancelBtn').style.display = 'block';
    
    // 수정 모드 설정
    editingId = id;
    
    // 스크롤을 폼으로 이동
    document.querySelector('.input-section').scrollIntoView({ behavior: 'smooth' });
}

// 수정 취소
function cancelEdit() {
    editingId = null;
    document.getElementById('transactionForm').reset();
    document.getElementById('formTitle').textContent = '새로운 항목 추가';
    document.getElementById('submitBtn').textContent = '추가';
    document.getElementById('cancelBtn').style.display = 'none';
}

// 거래 추가/수정
async function addTransaction(e) {
    e.preventDefault();

    try {
        const receiptFile = document.getElementById('receipt').files[0];
        let receiptURL = null;
        
        const transaction = {
            date: document.getElementById('date').value,
            type: document.getElementById('type').value,
            description: document.getElementById('description').value,
            amount: parseFloat(document.getElementById('amount').value),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editingId) {
            // 수정 모드
            const existingTransaction = transactions.find(t => t.id === editingId);
            
            // 새 영수증이 있는 경우에만 업로드
            if (receiptFile) {
                // 기존 영수증이 있다면 삭제
                if (existingTransaction.receiptURL) {
                    const oldImageRef = storage.refFromURL(existingTransaction.receiptURL);
                    await oldImageRef.delete();
                }
                receiptURL = await uploadReceipt(receiptFile);
                transaction.receiptURL = receiptURL;
            } else {
                // 새 영수증이 없으면 기존 영수증 URL 유지
                transaction.receiptURL = existingTransaction.receiptURL;
            }

            await db.collection('transactions').doc(editingId).update(transaction);
            const index = transactions.findIndex(t => t.id === editingId);
            transactions[index] = { ...transaction, id: editingId };
            
            // 수정 모드 종료
            cancelEdit();
        } else {
            // 추가 모드
            if (receiptFile) {
                receiptURL = await uploadReceipt(receiptFile);
                transaction.receiptURL = receiptURL;
            }

            const docRef = await db.collection('transactions').add(transaction);
            transaction.id = docRef.id;
            transactions.push(transaction);
        }

        updateUI();
        e.target.reset();
    } catch (error) {
        console.error("거래 처리 중 오류 발생:", error);
        alert("거래를 처리하는 중 오류가 발생했습니다.");
    }
}

// 거래 삭제
async function deleteTransaction(id) {
    try {
        const transaction = transactions.find(t => t.id === id);
        
        if (transaction.receiptURL) {
            try {
                const imageRef = storage.refFromURL(transaction.receiptURL);
                await imageRef.delete();
            } catch (error) {
                console.error("영수증 이미지 삭제 중 오류 발생:", error);
                // 이미지 삭제 실패해도 계속 진행
            }
        }

        await db.collection('transactions').doc(id).delete();
        transactions = transactions.filter(t => t.id !== id);
        updateUI();
    } catch (error) {
        console.error("거래 삭제 중 오류 발생:", error);
        alert("거래를 삭제하는 중 오류가 발생했습니다.");
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
}

function updateUI() {
    const transactionList = document.getElementById('transactionList');
    const totalBalance = document.getElementById('totalBalance');
    const totalIncome = document.getElementById('totalIncome');
    const totalExpense = document.getElementById('totalExpense');

    // 거래 내역 업데이트
    transactionList.innerHTML = '';
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    transactions.forEach(transaction => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${transaction.date}</td>
            <td><span class="badge ${transaction.type === '수입' ? 'bg-success' : 'bg-danger'}">${transaction.type}</span></td>
            <td>${transaction.description}</td>
            <td class="text-${transaction.type === '수입' ? 'success' : 'danger'}">${formatCurrency(transaction.amount)}</td>
            <td>
                ${transaction.receiptURL ? 
                    `<a href="${transaction.receiptURL}" target="_blank" rel="noopener noreferrer">
                        <img src="${transaction.receiptURL}" alt="영수증" class="receipt-thumbnail">
                    </a>` : 
                    '-'}
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-edit" onclick="editTransaction('${transaction.id}')">
                        <i class="bi bi-pencil"></i> 수정
                    </button>
                    <button class="btn btn-danger" onclick="deleteTransaction('${transaction.id}')">
                        <i class="bi bi-trash"></i> 삭제
                    </button>
                </div>
            </td>
        `;
        transactionList.appendChild(row);
    });

    // 합계 계산
    const income = transactions
        .filter(transaction => transaction.type === '수입')
        .reduce((total, transaction) => total + transaction.amount, 0);

    const expense = transactions
        .filter(transaction => transaction.type === '지출')
        .reduce((total, transaction) => total + transaction.amount, 0);

    const balance = income - expense;

    // 화면 업데이트
    totalBalance.textContent = formatCurrency(balance);
    totalIncome.textContent = formatCurrency(income);
    totalExpense.textContent = formatCurrency(expense);
}

// 에러 처리를 위한 전역 설정
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    alert('오류가 발생했습니다. 페이지를 새로고침하고 다시 시도해주세요.');
});

document.getElementById('transactionForm').addEventListener('submit', addTransaction);
window.addEventListener('load', loadTransactions);
