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

// 이미지 최적화 함수
async function optimizeImage(file, maxWidth = 1024) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // 이미지 크기 조정
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // 이미지 품질 조정 (0.6 = 60% 품질)
                const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
                resolve(optimizedDataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
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
        
        // 로딩 표시
        const submitBtn = document.getElementById('submitBtn');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 처리중...';
        
        const transaction = {
            date: document.getElementById('date').value,
            type: document.getElementById('type').value,
            description: document.getElementById('description').value,
            amount: parseFloat(document.getElementById('amount').value),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (receiptFile) {
            // 파일 크기 검사 (10MB 초과시 최적화)
            if (receiptFile.size > 10 * 1024 * 1024) {
                receiptData = await optimizeImage(receiptFile);
            } else {
                receiptData = await getBase64(receiptFile);
            }
            transaction.receiptData = receiptData;
        }

        if (editingId) {
            // 수정 모드
            const existingTransaction = transactions.find(t => t.id === editingId);
            
            if (!receiptFile && existingTransaction.receiptData) {
                transaction.receiptData = existingTransaction.receiptData;
            }

            await db.collection('transactions').doc(editingId).update(transaction);
            const index = transactions.findIndex(t => t.id === editingId);
            transactions[index] = { ...transaction, id: editingId };
            
            cancelEdit();
        } else {
            // 추가 모드
            const docRef = await db.collection('transactions').add(transaction);
            transaction.id = docRef.id;
            transactions.push(transaction);
        }

        // 필터 초기화
        document.getElementById('yearFilter').value = '';
        document.getElementById('monthFilter').value = '';
        
        updateUI();
        e.target.reset();
    } catch (error) {
        console.error("거래 처리 중 오류 발생:", error);
        alert("거래를 처리하는 중 오류가 발생했습니다.");
    } finally {
        // 버튼 상태 복구
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
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

// 영수증 모달 표시
function showReceiptModal(receiptData) {
    const modalImage = document.getElementById('modalReceiptImage');
    modalImage.src = receiptData;
    
    const receiptModal = new bootstrap.Modal(document.getElementById('receiptModal'));
    receiptModal.show();
}

// 년도 필터 옵션 설정
function setupYearFilter() {
    const yearFilter = document.getElementById('yearFilter');
    const years = new Set(transactions.map(t => t.date.substring(0, 4)));
    const sortedYears = Array.from(years).sort((a, b) => b - a); // 내림차순 정렬
    
    yearFilter.innerHTML = '<option value="">전체 년도</option>';
    sortedYears.forEach(year => {
        yearFilter.innerHTML += `<option value="${year}">${year}년</option>`;
    });
}

// 필터링된 거래 내역 가져오기
function getFilteredTransactions() {
    const yearFilter = document.getElementById('yearFilter').value;
    const monthFilter = document.getElementById('monthFilter').value;
    
    return transactions.filter(transaction => {
        const transactionYear = transaction.date.substring(0, 4);
        const transactionMonth = transaction.date.substring(5, 7);
        
        if (yearFilter && transactionYear !== yearFilter) return false;
        if (monthFilter && transactionMonth !== monthFilter) return false;
        
        return true;
    });
}

// updateUI 함수 수정
function updateUI() {
    const transactionList = document.getElementById('transactionList');
    const totalBalance = document.getElementById('totalBalance');
    const totalIncome = document.getElementById('totalIncome');
    const totalExpense = document.getElementById('totalExpense');

    // 필터링된 거래 내역 가져오기
    const filteredTransactions = getFilteredTransactions();
    
    transactionList.innerHTML = '';
    filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    filteredTransactions.forEach(transaction => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${transaction.date}</td>
            <td><span class="badge ${transaction.type === '수입' ? 'bg-success' : 'bg-danger'}">${transaction.type}</span></td>
            <td>${transaction.description}</td>
            <td class="text-${transaction.type === '수입' ? 'success' : 'danger'}">${formatCurrency(transaction.amount)}</td>
            <td>
                ${transaction.receiptData ? 
                    `<img src="${transaction.receiptData}" 
                         alt="영수증" 
                         class="receipt-thumbnail" 
                         onclick="showReceiptModal('${transaction.receiptData}')"
                         style="cursor: pointer;">` : 
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

    // 필터링된 거래 내역으로 합계 계산
    const income = filteredTransactions
        .filter(transaction => transaction.type === '수입')
        .reduce((total, transaction) => total + transaction.amount, 0);

    const expense = filteredTransactions
        .filter(transaction => transaction.type === '지출')
        .reduce((total, transaction) => total + transaction.amount, 0);

    const balance = income - expense;

    totalBalance.textContent = formatCurrency(balance);
    totalIncome.textContent = formatCurrency(income);
    totalExpense.textContent = formatCurrency(expense);
    
    // 년도 필터 옵션 업데이트
    setupYearFilter();
}

// 필터 변경 이벤트 리스너 추가
document.getElementById('yearFilter').addEventListener('change', updateUI);
document.getElementById('monthFilter').addEventListener('change', updateUI);

// 에러 처리를 위한 전역 설정
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    alert('오류가 발생했습니다. 페이지를 새로고침하고 다시 시도해주세요.');
});

document.getElementById('transactionForm').addEventListener('submit', addTransaction);
window.addEventListener('load', () => {
    loadTransactions().then(() => {
        setupYearFilter();
    });
});
