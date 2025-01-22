// Firebase 설정 및 초기화
const firebaseConfig = {
    apiKey: "AIzaSyAI-KtaTqmmxXQm0XRgRu9GIsVmWaJTTDI",
    authDomain: "carcular-c2b26.firebaseapp.com",
    projectId: "carcular-c2b26",
    storageBucket: "carcular-c2b26.firebasestorage.app",
    messagingSenderId: "159197763518",
    appId: "1:159197763518:web:599c178c8b25d255e9cbef",
    measurementId: "G-YBWK7K8L5E"
};

// 전역 변수 선언
let transactions = [];
let currentTransactionId = null;
let receiptModal = null;
let receiptViewModal = null;
let db = null;
let editTransactionModal = null;
let currentEditId = null;

// Firebase 초기화 함수
function initializeFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log('Firebase 초기화 성공');
        return true;
    } catch (error) {
        console.error('Firebase 초기화 오류:', error);
        return false;
    }
}

// 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', function() {
    // Firebase 초기화
    if (!initializeFirebase()) {
        alert('데이터베이스 연결에 실패했습니다.');
        return;
    }

    // Bootstrap 모달 초기화
    receiptViewModal = new bootstrap.Modal(document.getElementById('receiptViewModal'));

    // 모달 닫기 이벤트 리스너 설정
    const modalCloseButtons = document.querySelectorAll('[data-bs-dismiss="modal"]');
    modalCloseButtons.forEach(button => {
        button.addEventListener('click', function() {
            receiptViewModal.hide();
            const receiptImage = document.getElementById('receiptImage');
            if (receiptImage) {
                receiptImage.src = '';
            }
        });
    });

    // 모달 배경 클릭 시 닫기
    document.getElementById('receiptViewModal').addEventListener('click', function(e) {
        if (e.target === this) {
            receiptViewModal.hide();
            const receiptImage = document.getElementById('receiptImage');
            if (receiptImage) {
                receiptImage.src = '';
            }
        }
    });

    // 폼 제출 이벤트 리스너
    const form = document.getElementById('transactionForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // 현재 날짜 설정
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    // 수정 모달 초기화
    editTransactionModal = new bootstrap.Modal(document.getElementById('editTransactionModal'));

    // 초기 데이터 로드
    loadTransactions();
});

// 폼 제출 처리
async function handleFormSubmit(e) {
    e.preventDefault();
    showLoading();

    try {
        const date = document.getElementById('date').value;
        const description = document.getElementById('description').value;
        const type = document.getElementById('type').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const receiptFile = document.getElementById('receipt').files[0];

        if (receiptFile) {
            const reader = new FileReader();
            reader.onload = async function(e) {
                await addTransaction(date, description, type, amount, e.target.result);
            };
            reader.readAsDataURL(receiptFile);
        } else {
            await addTransaction(date, description, type, amount, null);
        }
    } catch (error) {
        console.error('폼 제출 오류:', error);
        alert('거래를 추가하는 중 오류가 발생했습니다.');
    } finally {
        hideLoading();
    }
}

// 거래 추가
async function addTransaction(date, description, type, amount, receiptUrl) {
    try {
        const docRef = await db.collection('transactions').add({
            date,
            description,
            type,
            amount,
            receiptUrl,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('거래 추가됨:', docRef.id);
        
        // 폼 초기화
        document.getElementById('transactionForm').reset();
        document.getElementById('date').valueAsDate = new Date();
        
        // 거래 목록 새로고침
        await loadTransactions();
    } catch (error) {
        console.error('거래 추가 오류:', error);
        throw error;
    }
}

// 거래 목록 로드
async function loadTransactions() {
    try {
        const snapshot = await db.collection('transactions')
            .orderBy('date', 'desc')
            .get();

        transactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        displayTransactions();
        updateSummary();
    } catch (error) {
        console.error('거래 목록 로드 오류:', error);
    }
}

// 거래 목록 표시
function displayTransactions() {
    const transactionList = document.getElementById('transactionList');
    if (!transactionList) return;

    let html = `
        <table class="table">
            <thead>
                <tr>
                    <th>날짜</th>
                    <th>내용</th>
                    <th>구분</th>
                    <th>금액</th>
                    <th>영수증</th>
                    <th>작업</th>
                </tr>
            </thead>
            <tbody>
    `;

    transactions.forEach(transaction => {
        html += `
            <tr>
                <td>${transaction.date}</td>
                <td>${transaction.description}</td>
                <td>${transaction.type === 'income' ? '수입' : '지출'}</td>
                <td>${transaction.amount.toLocaleString()}원</td>
                <td>
                    ${transaction.receiptUrl 
                        ? `<img src="${transaction.receiptUrl}" 
                             class="receipt-thumbnail" 
                             onclick="viewReceipt('${transaction.receiptUrl}')"
                             alt="영수증">`
                        : '없음'}
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditModal('${transaction.id}')">
                        수정
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteTransaction('${transaction.id}')">
                        삭제
                    </button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    transactionList.innerHTML = html;
}

// 요약 정보 업데이트
function updateSummary() {
    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = totalIncome - totalExpense;

    document.getElementById('totalIncome').textContent = totalIncome.toLocaleString() + '원';
    document.getElementById('totalExpense').textContent = totalExpense.toLocaleString() + '원';
    document.getElementById('balance').textContent = balance.toLocaleString() + '원';
}

// 로딩 표시
function showLoading() {
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.innerHTML = `
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
    `;
    document.body.appendChild(spinner);
}

function hideLoading() {
    const spinner = document.querySelector('.loading-spinner');
    if (spinner) {
        spinner.remove();
    }
}

// 영수증 이미지 보기 함수
function viewReceipt(receiptUrl) {
    const receiptImage = document.getElementById('receiptImage');
    if (receiptImage) {
        receiptImage.src = receiptUrl;
        receiptViewModal.show();
    }
}

// 수정 모달 열기
function openEditModal(transactionId) {
    currentEditId = transactionId;
    const transaction = transactions.find(t => t.id === transactionId);
    
    if (transaction) {
        document.getElementById('editDate').value = transaction.date;
        document.getElementById('editDescription').value = transaction.description;
        document.getElementById('editType').value = transaction.type;
        document.getElementById('editAmount').value = transaction.amount;
        
        editTransactionModal.show();
    }
}

// 거래 수정
async function updateTransaction() {
    try {
        showLoading();
        
        const date = document.getElementById('editDate').value;
        const description = document.getElementById('editDescription').value;
        const type = document.getElementById('editType').value;
        const amount = parseFloat(document.getElementById('editAmount').value);
        const receiptFile = document.getElementById('editReceipt').files[0];

        let receiptUrl = null;
        const transaction = transactions.find(t => t.id === currentEditId);
        
        if (receiptFile) {
            const reader = new FileReader();
            reader.onload = async function(e) {
                receiptUrl = e.target.result;
                await updateTransactionData(date, description, type, amount, receiptUrl);
            };
            reader.readAsDataURL(receiptFile);
        } else {
            // 기존 영수증 유지
            receiptUrl = transaction ? transaction.receiptUrl : null;
            await updateTransactionData(date, description, type, amount, receiptUrl);
        }
    } catch (error) {
        console.error('거래 수정 오류:', error);
        alert('거래를 수정하는 중 오류가 발생했습니다.');
    } finally {
        hideLoading();
    }
}

// 거래 데이터 업데이트
async function updateTransactionData(date, description, type, amount, receiptUrl) {
    try {
        await db.collection('transactions').doc(currentEditId).update({
            date,
            description,
            type,
            amount,
            receiptUrl,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        editTransactionModal.hide();
        await loadTransactions();
        alert('거래가 수정되었습니다.');
    } catch (error) {
        console.error('데이터 업데이트 오류:', error);
        throw error;
    }
}

// 거래 삭제
async function deleteTransaction(transactionId) {
    if (!confirm('정말 이 거래를 삭제하시겠습니까?')) {
        return;
    }

    try {
        showLoading();
        await db.collection('transactions').doc(transactionId).delete();
        await loadTransactions();
        alert('거래가 삭제되었습니다.');
    } catch (error) {
        console.error('거래 삭제 오류:', error);
        alert('거래를 삭제하는 중 오류가 발생했습니다.');
    } finally {
        hideLoading();
    }
}
