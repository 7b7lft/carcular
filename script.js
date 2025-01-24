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
let transactions = [];
let editingId = null;

// 이미지를 Base64로 변환
function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Firestore에서 데이터 가져오기
async function loadTransactions() {
    const snapshot = await db.collection('transactions').get();
    transactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
    updateUI();
}

// 거래 추가/수정
async function addTransaction(e) {
    e.preventDefault();

    try {
        const receiptFile = document.getElementById('receipt').files[0];
        let receiptData = null;
        
        const transaction = {
            date: document.getElementById('date').value,
            type: document.getElementById('type').value,
            description: document.getElementById('description').value,
            amount: parseFloat(document.getElementById('amount').value),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (receiptFile) {
            receiptData = await getBase64(receiptFile);
            transaction.receiptData = receiptData;
        }

        if (editingId) {
            // 수정 모드
            const existingTransaction = transactions.find(t => t.id === editingId);
            
            // 새 영수증이 없으면 기존 영수증 데이터 유지
            if (!receiptFile && existingTransaction.receiptData) {
                transaction.receiptData = existingTransaction.receiptData;
            }

            await db.collection('transactions').doc(editingId).update(transaction);
            const index = transactions.findIndex(t => t.id === editingId);
            transactions[index] = { ...transaction, id: editingId };
            
            // 수정 모드 종료
            cancelEdit();
        } else {
            // 추가 모드
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

// 수정 모드로 전환
function editTransaction(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    document.getElementById('date').value = transaction.date;
    document.getElementById('type').value = transaction.type;
    document.getElementById('description').value = transaction.description;
    document.getElementById('amount').value = transaction.amount;
    
    document.getElementById('formTitle').textContent = '항목 수정';
    document.getElementById('submitBtn').textContent = '수정';
    document.getElementById('cancelBtn').style.display = 'block';
    
    editingId = id;
    
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

// 거래 삭제
async function deleteTransaction(id) {
    try {
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
                ${transaction.receiptData ? 
                    `<img src="${transaction.receiptData}" alt="영수증" class="receipt-thumbnail" onclick="window.open('${transaction.receiptData}', '_blank')">` : 
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

    const income = transactions
        .filter(transaction => transaction.type === '수입')
        .reduce((total, transaction) => total + transaction.amount, 0);

    const expense = transactions
        .filter(transaction => transaction.type === '지출')
        .reduce((total, transaction) => total + transaction.amount, 0);

    const balance = income - expense;

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
