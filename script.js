// Firebase 초기화 및 데이터베이스 참조
const firebaseConfig = {
    apiKey: "AIzaSyAI-KtaTqmmxXQm0XRgRu9GIsVmWaJTTDI",
    authDomain: "carcular-c2b26.firebaseapp.com",
    projectId: "carcular-c2b26",
    storageBucket: "carcular-c2b26.firebasestorage.app",
    messagingSenderId: "159197763518",
    appId: "1:159197763518:web:599c178c8b25d255e9cbef",
    measurementId: "G-YBWK7K8L5E"
};

// Firebase 초기화 확인
if (!firebase.apps.length) {
    try {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase 초기화 성공');
    } catch (error) {
        console.error('Firebase 초기화 실패:', error);
    }
}

// Firestore 데이터베이스 참조
const db = firebase.firestore();

// 전역 변수
let transactions = [];
let currentYearFilter = '';
let currentMonthFilter = '';
let editModal = null;
let currentPage = 1;
let pageSize = 10;

// 데이터베이스 연결 확인
async function checkDatabaseConnection() {
    try {
        await db.collection('transactions').get();
        console.log('데이터베이스 연결 성공');
        return true;
    } catch (error) {
        console.error('데이터베이스 연결 오류:', error);
        alert('데이터베이스 연결에 실패했습니다. 페이지를 새로고침해주세요.');
        return false;
    }
}

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
    currentPage = 1;
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

// loadTransactions 함수 수정
async function loadTransactions() {
    console.log('거래내역 로딩 시작'); // 디버깅 로그
    try {
        const snapshot = await db.collection('transactions').get();
        console.log('Firestore 쿼리 결과:', snapshot.size); // 디버깅 로그

        transactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log('로드된 거래내역:', transactions.length); // 디버깩 로그
        updateUI();
    } catch (error) {
        console.error('거래내역 로딩 중 오류:', error);
        alert('거래내역을 불러오는데 실패했습니다.');
    }
}

// addTransaction 함수 수정
async function addTransaction(e) {
    e.preventDefault();
    console.log('거래내역 추가 시작'); // 디버깅 로그

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');

    try {
        // 입력값 검증
        const date = form.querySelector('#date').value;
        const type = form.querySelector('#type').value;
        const description = form.querySelector('#description').value;
        const amountStr = form.querySelector('#amount').value;
        const amount = parseInt(amountStr.replace(/,/g, ''));

        console.log('입력값:', { date, type, description, amount }); // 디버깅 로그

        if (!date || !type || !description || isNaN(amount)) {
            throw new Error('모든 필드를 올바르게 입력해주세요.');
        }

        // 버튼 비활성화 및 로딩 표시
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 처리중...';

        // 거래내역 객체 생성
        const transaction = {
            date,
            type,
            description,
            amount,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        // 영수증 처리
        const receiptInput = form.querySelector('#receipt');
        if (receiptInput && receiptInput.files.length > 0) {
            const receiptFile = receiptInput.files[0];
            const receiptData = await optimizeImage(receiptFile);
            transaction.receiptData = receiptData;
        }

        console.log('Firestore에 추가할 데이터:', transaction); // 디버깅 로그

        // Firestore에 데이터 추가
        const docRef = await db.collection('transactions').add(transaction);
        console.log('Firestore 문서 ID:', docRef.id); // 디버깅 로그

        // 로컬 배열에 추가
        const newTransaction = { id: docRef.id, ...transaction };
        transactions.push(newTransaction);

        // UI 업데이트
        updateUI();
        
        // 폼 초기화
        form.reset();
        
        // 성공 메시지
        alert('거래내역이 성공적으로 추가되었습니다.');

    } catch (error) {
        console.error('거래내역 추가 중 오류:', error); // 자세한 에러 로그
        alert(`거래내역 추가 실패: ${error.message}`);
    } finally {
        // 버튼 상태 복구
        submitBtn.disabled = false;
        submitBtn.innerHTML = '추가';
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
        if (!transaction.date) return false;
        
        const transactionDate = new Date(transaction.date);
        const transactionYear = transactionDate.getFullYear().toString();
        const transactionMonth = (transactionDate.getMonth() + 1).toString().padStart(2, '0');
        
        if (yearFilter && transactionYear !== yearFilter) return false;
        if (monthFilter && transactionMonth !== monthFilter) return false;
        
        return true;
    });
}

// 년도 필터 옵션 설정 함수 수정
function setupYearFilter() {
    const yearFilter = document.getElementById('yearFilter');
    if (!yearFilter) return;

    const currentValue = yearFilter.value; // 현재 선택된 값 저장
    
    // 유효한 날짜가 있는 거래 내역에서만 년도 추출
    const years = new Set(
        transactions
            .filter(t => t.date)
            .map(t => new Date(t.date).getFullYear().toString())
    );
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    
    yearFilter.innerHTML = '<option value="">전체 년도</option>';
    sortedYears.forEach(year => {
        yearFilter.innerHTML += `<option value="${year}">${year}년</option>`;
    });
    
    yearFilter.value = currentValue; // 이전 선택값 복원
}

// 월 필터 초기화 함수 추가
function setupMonthFilter() {
    const monthFilter = document.getElementById('monthFilter');
    if (!monthFilter) return;

    const currentValue = monthFilter.value; // 현재 선택된 값 저장
    
    monthFilter.innerHTML = `
        <option value="">전체 월</option>
        ${Array.from({length: 12}, (_, i) => {
            const month = (i + 1).toString().padStart(2, '0');
            return `<option value="${month}">${i + 1}월</option>`;
        }).join('')}
    `;
    
    monthFilter.value = currentValue; // 이전 선택값 복원
}

// updateUI 함수 수정
function updateUI() {
    const desktopList = document.getElementById('desktopTransactionList');
    const mobileList = document.getElementById('mobileTransactionList');
    const totalBalance = document.getElementById('totalBalance');
    const totalIncome = document.getElementById('totalIncome');
    const totalExpense = document.getElementById('totalExpense');
    const totalItemsSpan = document.getElementById('totalItems');
    
    if (!desktopList || !mobileList) {
        console.error('Transaction list elements not found');
        return;
    }

    // 필터링된 거래 내역 가져오기
    const filteredTransactions = getFilteredTransactions();
    filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 총 아이템 수 표시
    totalItemsSpan.textContent = filteredTransactions.length;

    // 페이지네이션 계산
    const totalPages = Math.ceil(filteredTransactions.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredTransactions.length);
    const currentTransactions = filteredTransactions.slice(startIndex, endIndex);

    // 페이지네이션 UI 업데이트
    updatePagination(totalPages);

    if (currentTransactions.length === 0) {
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
                ${currentTransactions.map(transaction => `
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
        desktopList.innerHTML = currentTransactions.map(transaction => `
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
        const income = currentTransactions
            .filter(transaction => transaction.type === '수입')
            .reduce((total, transaction) => total + transaction.amount, 0);

        const expense = currentTransactions
            .filter(transaction => transaction.type === '지출')
            .reduce((total, transaction) => total + transaction.amount, 0);

        const balance = income - expense;

        totalBalance.textContent = formatCurrency(balance);
        totalIncome.textContent = formatCurrency(income);
        totalExpense.textContent = formatCurrency(expense);
    }
    
    // 필터 옵션 업데이트
    setupYearFilter();
    setupMonthFilter();
    restoreFilterValues();
}

// 페이지네이션 UI 업데이트 함수
function updatePagination(totalPages) {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    let paginationHTML = '';

    // 이전 페이지 버튼
    paginationHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1})" aria-label="이전">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
    `;

    // 페이지 번호 버튼
    for (let i = 1; i <= totalPages; i++) {
        // 현재 페이지 주변의 페이지만 표시
        if (
            i === 1 || // 첫 페이지
            i === totalPages || // 마지막 페이지
            (i >= currentPage - 2 && i <= currentPage + 2) // 현재 페이지 주변
        ) {
            paginationHTML += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
                </li>
            `;
        } else if (
            i === currentPage - 3 ||
            i === currentPage + 3
        ) {
            // 생략 부호 추가
            paginationHTML += `
                <li class="page-item disabled">
                    <span class="page-link">...</span>
                </li>
            `;
        }
    }

    // 다음 페이지 버튼
    paginationHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1})" aria-label="다음">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    `;

    pagination.innerHTML = paginationHTML;
}

// 페이지 변경 함수
function changePage(newPage) {
    const totalPages = Math.ceil(getFilteredTransactions().length / pageSize);
    
    if (newPage < 1 || newPage > totalPages) return;
    
    currentPage = newPage;
    updateUI();
}

// 페이지 크기 변경 이벤트 리스너
document.addEventListener('DOMContentLoaded', () => {
    editModal = new bootstrap.Modal(document.getElementById('editModal'));
    
    // 필터 변경 이벤트 리스너
    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');
    
    if (yearFilter && monthFilter) {
        yearFilter.addEventListener('change', handleFilterChange);
        monthFilter.addEventListener('change', handleFilterChange);
        
        // 초기 필터 설정
        setupMonthFilter();
    }
    
    loadTransactions();

    const pageSizeSelect = document.getElementById('pageSize');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            pageSize = parseInt(e.target.value);
            currentPage = 1; // 페이지 크기 변경 시 첫 페이지로 이동
            updateUI();
        });
    }

    const transactionForm = document.getElementById('transactionForm');
    if (transactionForm) {
        transactionForm.addEventListener('submit', addTransaction);
        console.log('폼 이벤트 리스너 등록 완료'); // 디버깅 로그
    } else {
        console.error('거래내역 폼을 찾을 수 없습니다.');
    }
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
    // 숫자와 쉼표만 남기고 모두 제거
    let value = input.value.replace(/[^\d,]/g, '');
    // 쉼표 제거
    value = value.replace(/,/g, '');
    if (value) {
        // 숫자를 정수로 변환 후 천단위 쉼표 추가
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
