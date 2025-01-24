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
let editModal = null;

// 현재 필터 값을 저장할 전역 변수
let currentYearFilter = '';
let currentMonthFilter = '';

// 필터 값 저장 함수
function saveFilterValues() {
    currentYearFilter = document.getElementById('yearFilter').value;
    currentMonthFilter = document.getElementById('monthFilter').value;
}

// 필터 값 복원 함수
function restoreFilterValues() {
    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');
    
    if (yearFilter && monthFilter) {
        yearFilter.value = currentYearFilter;
        monthFilter.value = currentMonthFilter;
    }
}

// 필터 변경 이벤트 핸들러
function handleFilterChange() {
    saveFilterValues();
    updateUI();
}

// 이미지를 Base64로 변환
function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// 이미지 최적화 함수 개선
async function optimizeImage(file, maxWidth = 800) {
    return new Promise((resolve, reject) => {
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

                // 이미지 품질을 점진적으로 낮추며 최적화
                let quality = 0.7;
                let optimizedDataUrl;
                let iteration = 0;
                const maxIterations = 5;

                do {
                    optimizedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    quality -= 0.1;
                    iteration++;
                } while (optimizedDataUrl.length > 1024 * 1024 && iteration < maxIterations && quality > 0.1);

                resolve(optimizedDataUrl);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 파일 크기 검사 함수
function checkFileSize(file) {
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
        throw new Error(`파일 크기가 너무 큽니다. 20MB 이하의 파일만 업로드 가능합니다. (현재 크기: ${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
    }
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

    const submitBtn = document.getElementById('submitBtn');
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 처리중...';
        
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
            try {
                // 파일 크기 검사
                checkFileSize(receiptFile);
                
                // 모든 이미지 최적화 처리
                receiptData = await optimizeImage(receiptFile);
                
                // 최적화 후에도 크기가 큰 경우 추가 압축
                if (receiptData.length > 1024 * 1024) {
                    receiptData = await optimizeImage(receiptFile, 600); // 더 작은 크기로 재시도
                }
                
                transaction.receiptData = receiptData;
            } catch (error) {
                alert(error.message || "이미지 처리 중 오류가 발생했습니다.");
                throw error;
            }
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
        alert(error.message || "거래를 처리하는 중 오류가 발생했습니다.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = editingId ? '수정' : '추가';
    }
}

// 수정 모드로 전환
function editTransaction(id) {
    editingId = id;
    const transaction = transactions.find(t => t.id === id);
    
    if (!transaction) return;

    // 폼 필드에 데이터 설정
    document.getElementById('editDate').value = transaction.date;
    document.getElementById('editType').value = transaction.type;
    document.getElementById('editDescription').value = transaction.description;
    document.getElementById('editAmount').value = transaction.amount.toLocaleString('ko-KR');

    // 현재 영수증 이미지 표시
    const previewDiv = document.getElementById('currentReceiptPreview');
    if (transaction.receiptData) {
        previewDiv.innerHTML = `
            <div class="mt-2">
                <p class="mb-2">현재 영수증:</p>
                <img src="${transaction.receiptData}" 
                     alt="현재 영수증" 
                     class="img-thumbnail" 
                     style="max-height: 200px;">
            </div>
        `;
    } else {
        previewDiv.innerHTML = '';
    }

    editModal.show();
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

// 년도 필터 옵션 설정 함수 수정
function setupYearFilter() {
    const yearFilter = document.getElementById('yearFilter');
    if (!yearFilter) return;

    const years = new Set(transactions.map(t => t.date.substring(0, 4)));
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    
    const currentValue = yearFilter.value; // 현재 선택된 값 저장
    
    yearFilter.innerHTML = '<option value="">전체 년도</option>';
    sortedYears.forEach(year => {
        yearFilter.innerHTML += `<option value="${year}">${year}년</option>`;
    });
    
    yearFilter.value = currentValue; // 이전 선택값 복원
}

// updateUI 함수 수정
function updateUI() {
    const desktopList = document.getElementById('desktopTransactionList');
    const mobileList = document.getElementById('mobileTransactionList');
    const totalBalance = document.getElementById('totalBalance');
    const totalIncome = document.getElementById('totalIncome');
    const totalExpense = document.getElementById('totalExpense');

    if (!desktopList || !mobileList) {
        console.error('Transaction list elements not found');
        return;
    }

    // 필터링된 거래 내역 가져오기
    const filteredTransactions = getFilteredTransactions();
    filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filteredTransactions.length === 0) {
        const emptyMessage = `
            <div class="text-center py-4 text-muted">
                <i class="bi bi-inbox fs-2 mb-2"></i>
                <p class="mb-0">내역이 없습니다</p>
            </div>
        `;
        
        desktopList.innerHTML = `<tr><td colspan="6">${emptyMessage}</td></tr>`;
        mobileList.innerHTML = emptyMessage;
    } else {
        // 모바일용 카드 UI
        mobileList.innerHTML = `
            <div class="transaction-cards">
                ${filteredTransactions.map(transaction => `
                    <div class="transaction-card">
                        <div class="card-header">
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="date">${transaction.date}</span>
                                <span class="badge ${transaction.type === '수입' ? 'bg-success' : 'bg-danger'}">${transaction.type}</span>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div class="description">${transaction.description}</div>
                                <div class="amount text-${transaction.type === '수입' ? 'success' : 'danger'} fw-bold">
                                    ${formatCurrency(transaction.amount)}
                                </div>
                            </div>
                            ${transaction.receiptData ? `
                                <div class="receipt-image mb-2">
                                    <img src="${transaction.receiptData}" 
                                         alt="영수증" 
                                         class="receipt-thumbnail-mobile" 
                                         onclick="showReceiptModal('${transaction.receiptData}')">
                                </div>
                            ` : ''}
                            <div class="d-flex gap-2 justify-content-end">
                                <button class="btn btn-edit btn-sm" onclick="editTransaction('${transaction.id}')">
                                    <i class="bi bi-pencil-square"></i> 수정
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="deleteTransaction('${transaction.id}')">
                                    <i class="bi bi-trash3-fill"></i> 삭제
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // 데스크톱용 테이블 UI
        desktopList.innerHTML = filteredTransactions.map(transaction => `
            <tr>
                <td class="date-cell">${transaction.date}</td>
                <td class="type-cell"><span class="badge ${transaction.type === '수입' ? 'bg-success' : 'bg-danger'}">${transaction.type}</span></td>
                <td class="desc-cell">${transaction.description}</td>
                <td class="amount-cell text-${transaction.type === '수입' ? 'success' : 'danger'}">${formatCurrency(transaction.amount)}</td>
                <td class="receipt-cell">
                    ${transaction.receiptData ? 
                        `<img src="${transaction.receiptData}" 
                             alt="영수증" 
                             class="receipt-thumbnail" 
                             onclick="showReceiptModal('${transaction.receiptData}')"
                             style="cursor: pointer;">` : 
                        '-'}
                </td>
                <td class="action-cell">
                    <div class="d-flex gap-1 action-buttons">
                        <button class="btn btn-edit btn-sm" onclick="editTransaction('${transaction.id}')" title="수정">
                            <i class="bi bi-pencil-square me-1"></i>수정
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteTransaction('${transaction.id}')" title="삭제">
                            <i class="bi bi-trash3-fill me-1"></i>삭제
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // 합계 계산 및 표시
    if (totalBalance && totalIncome && totalExpense) {
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
    }
    
    // 년도 필터 옵션 업데이트 후 필터 값 복원
    setupYearFilter();
    restoreFilterValues();
}

// 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', () => {
    editModal = new bootstrap.Modal(document.getElementById('editModal'));
    
    // 필터 변경 이벤트 리스너
    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');
    
    if (yearFilter && monthFilter) {
        yearFilter.addEventListener('change', handleFilterChange);
        monthFilter.addEventListener('change', handleFilterChange);
    }
    
    loadTransactions();
});

// resize 이벤트 핸들러 수정
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        updateUI();
    }, 250); // 디바운스 처리
});

// 숫자 입력 시 천단위 콤마 표시
function formatAmount(input) {
    let value = input.value.replace(/[^\d]/g, '');
    if (value) {
        value = parseInt(value).toLocaleString('ko-KR');
        input.value = value;
    }
}

// 수정 내용 저장
async function saveEdit() {
    try {
        const editForm = document.getElementById('editForm');
        if (!editForm.checkValidity()) {
            editForm.reportValidity();
            return;
        }

        const transaction = {
            date: document.getElementById('editDate').value,
            type: document.getElementById('editType').value,
            description: document.getElementById('editDescription').value,
            amount: parseInt(document.getElementById('editAmount').value.replace(/,/g, '')),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        const receiptFile = document.getElementById('editReceipt').files[0];
        const existingTransaction = transactions.find(t => t.id === editingId);

        if (receiptFile) {
            // 새 영수증 이미지가 있는 경우
            try {
                const receiptData = await optimizeImage(receiptFile);
                transaction.receiptData = receiptData;
            } catch (error) {
                alert("영수증 이미지 처리 중 오류가 발생했습니다.");
                throw error;
            }
        } else if (existingTransaction.receiptData) {
            // 기존 영수증 유지
            transaction.receiptData = existingTransaction.receiptData;
        }

        // Firestore 업데이트
        await db.collection('transactions').doc(editingId).update(transaction);

        // 로컬 데이터 업데이트
        const index = transactions.findIndex(t => t.id === editingId);
        transactions[index] = { ...transaction, id: editingId };

        // UI 업데이트
        updateUI();
        editModal.hide();
        
        // 성공 메시지
        alert('거래 내역이 수정되었습니다.');
    } catch (error) {
        console.error("수정 중 오류 발생:", error);
        alert("수정 중 오류가 발생했습니다.");
    }
}
