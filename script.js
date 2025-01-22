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

// Firebase 초기화
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// 전역 변수 선언
let transactions = [];
let currentTransactionId = null;
let receiptModal = null;
let receiptViewModal = null;

// Firebase 초기화 확인
function waitForFirebase() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const checkFirebase = setInterval(() => {
            attempts++;
            if (window.db) {
                clearInterval(checkFirebase);
                resolve(window.db);
            } else if (attempts > 50) { // 5초 후 타임아웃
                clearInterval(checkFirebase);
                reject(new Error('Firebase 초기화 실패'));
            }
        }, 100);
    });
}

// 애플리케이션 초기화
async function initializeApp() {
    try {
        await waitForFirebase();
        
        // Bootstrap 모달 초기화
        const receiptModalEl = document.getElementById('receiptModal');
        const receiptViewModalEl = document.getElementById('receiptViewModal');
        
        if (!receiptModalEl || !receiptViewModalEl) {
            throw new Error('모달 요소를 찾을 수 없습니다.');
        }

        receiptModal = new bootstrap.Modal(receiptModalEl);
        receiptViewModal = new bootstrap.Modal(receiptViewModalEl);
        
        // 모달 이벤트 리스너 설정
        setupModalListeners(receiptModalEl, receiptViewModalEl);
        
        // 기타 이벤트 리스너 설정
        setupEventListeners();
        
        // 초기 데이터 로드
        await loadTransactions();
        
        // 현재 날짜 설정
        const dateInput = document.getElementById('date');
        if (dateInput) {
            dateInput.valueAsDate = new Date();
        }

        console.log('애플리케이션 초기화 완료');
    } catch (error) {
        console.error('초기화 오류:', error);
        alert('애플리케이션 초기화 중 오류가 발생했습니다.');
    }
}

// 모달 이벤트 리스너 설정
function setupModalListeners(receiptModalEl, receiptViewModalEl) {
    receiptModalEl.addEventListener('hidden.bs.modal', function () {
        const receiptUpdate = document.getElementById('receiptUpdate');
        if (receiptUpdate) {
            receiptUpdate.value = '';
        }
        currentTransactionId = null;
    });

    receiptViewModalEl.addEventListener('hidden.bs.modal', function () {
        const receiptImage = document.getElementById('receiptImage');
        if (receiptImage) {
            receiptImage.src = '';
        }
    });
}

// DOM 로드 완료 시 초기화
document.addEventListener('DOMContentLoaded', initializeApp);

function setupEventListeners() {
    // 거래 목록 이벤트 위임
    document.getElementById('transactionList').addEventListener('click', function(e) {
        if (e.target.classList.contains('receipt-thumbnail')) {
            viewReceipt(e.target.getAttribute('data-receipt-url'));
        }
        if (e.target.classList.contains('add-receipt-btn') || 
            e.target.closest('.add-receipt-btn')) {
            const transactionId = e.target.closest('.add-receipt-btn').getAttribute('data-transaction-id');
            openReceiptModal(transactionId);
        }
    });

    // 폼 제출 이벤트
    document.getElementById('transactionForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        showLoading();
        
        const date = document.getElementById('date').value;
        const description = document.getElementById('description').value;
        const type = document.getElementById('type').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const receiptFile = document.getElementById('receipt').files[0];
        
        try {
            if (receiptFile) {
                const reader = new FileReader();
                reader.onload = async function(e) {
                    await addTransaction(date, description, type, amount, e.target.result);
                };
                reader.readAsDataURL(receiptFile);
            } else {
                await addTransaction(date, description, type, amount, null);
            }
            
            this.reset();
            // 현재 날짜를 다시 설정
            document.getElementById('date').valueAsDate = new Date();
        } catch (error) {
            console.error('거래 추가 오류:', error);
            alert('거래를 추가하는 중 오류가 발생했습니다.');
        } finally {
            hideLoading();
        }
    });
}

async function addTransaction(date, description, type, amount, receiptUrl) {
    if (!window.db) {
        throw new Error('데이터베이스 연결이 설정되지 않았습니다.');
    }

    try {
        const docRef = await window.db.collection('transactions').add({
            date,
            description,
            type,
            amount,
            receiptUrl,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('거래 추가 성공:', docRef.id);
        await loadTransactions();
    } catch (error) {
        console.error('거래 추가 오류:', error);
        throw error;
    }
}

async function loadTransactions() {
    try {
        showLoading();
        const snapshot = await window.db.collection('transactions')
            .orderBy('date', 'desc')
            .get();
        
        transactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        updateSummary();
        displayTransactions();
    } catch (error) {
        console.error('거래 목록 로드 오류:', error);
        alert('거래 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
        hideLoading();
    }
}

function displayTransactions(filteredTransactions = transactions) {
    const transactionList = document.getElementById('transactionList');
    let html = `
        <table class="table table-hover">
            <thead>
                <tr>
                    <th>날짜</th>
                    <th>내용</th>
                    <th>구분</th>
                    <th>금액</th>
                    <th>영수증</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach(transaction => {
            const receiptUrl = transaction.receiptUrl ? transaction.receiptUrl.replace(/'/g, "\\'") : '';
            html += `
                <tr class="transaction-item">
                    <td>${transaction.date}</td>
                    <td>${transaction.description}</td>
                    <td>${transaction.type === 'income' ? '수입' : '지출'}</td>
                    <td class="${transaction.type === 'income' ? 'text-success' : 'text-danger'}">
                        ${transaction.type === 'income' ? '+' : '-'}
                        ${transaction.amount.toLocaleString()}원
                    </td>
                    <td>
                        ${transaction.receiptUrl ? 
                            `<img src="${receiptUrl}" 
                                class="receipt-thumbnail" 
                                data-receipt-url="${receiptUrl}">` 
                            : `<button class="btn btn-sm btn-outline-primary add-receipt-btn" 
                                data-transaction-id="${transaction.id}">
                                <i class="bi bi-plus-circle"></i> 영수증
                               </button>`}
                    </td>
                </tr>
            `;
        });
    
    html += '</tbody></table>';
    transactionList.innerHTML = html;
}

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

function viewReceipt(receiptUrl) {
    document.getElementById('receiptImage').src = receiptUrl;
    receiptViewModal.show();
}

function openReceiptModal(transactionId) {
    currentTransactionId = transactionId;
    receiptModal.show();
}

async function updateReceipt() {
    const receiptFile = document.getElementById('receiptUpdate').files[0];
    if (!receiptFile) {
        alert('영수증 파일을 선택해주세요.');
        return;
    }

    try {
        showLoading();
        const reader = new FileReader();
        reader.onload = async function(e) {
            await window.db.collection('transactions').doc(currentTransactionId).update({
                receiptUrl: e.target.result,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            await loadTransactions();
            receiptModal.hide();
            document.getElementById('receiptUpdate').value = '';
        };
        reader.readAsDataURL(receiptFile);
    } catch (error) {
        console.error('영수증 업데이트 오류:', error);
        alert('영수증을 업데이트하는 중 오류가 발생했습니다.');
    } finally {
        hideLoading();
    }
}

async function filterTransactions() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        alert('시작일과 종료일을 모두 선택해주세요.');
        return;
    }
    
    try {
        showLoading();
        const snapshot = await window.db.collection('transactions')
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .orderBy('date', 'desc')
            .get();
        
        const filteredTransactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        displayTransactions(filteredTransactions);
    } catch (error) {
        console.error('거래 필터링 오류:', error);
        alert('거래를 필터링하는 중 오류가 발생했습니다.');
    } finally {
        hideLoading();
    }
}

// 모달 닫기 버튼 이벤트 리스너
document.querySelector('.close').onclick = function() {
    receiptModal.hide();
    document.getElementById('receiptUpdate').value = '';
    currentTransactionId = null;
};

// 모달 외부 클릭 시 닫기
window.onclick = function(event) {
    const modal = document.getElementById('receiptModal');
    if (event.target == modal) {
        receiptModal.hide();
    }
}
