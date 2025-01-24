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
let availableYears = new Set();
let currentYear = new Date().getFullYear().toString();

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

    // 메인 연도 필터 초기화
    initMainYearFilter();
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
        // 현재 선택된 연도의 데이터만 로드
        const startDate = `${currentYear}0101`;
        const endDate = `${currentYear}1231`;
        
        const snapshot = await db.collection('transactions')
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .get();
        
        transactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // 날짜순 정렬
        transactions.sort((a, b) => b.date.localeCompare(a.date));
        
        displayTransactions();
        updateSummary();
    } catch (error) {
        console.error('거래 목록 로드 오류:', error);
        alert('거래 목록을 불러오는 중 오류가 발생했습니다.');
    }
}

// 거래 목록 표시
function displayTransactions() {
    const transactionList = document.getElementById('transactionList');
    if (!transactionList) return;

    if (!transactions || transactions.length === 0) {
        transactionList.innerHTML = '<p class="text-center my-3">거래 내역이 없습니다.</p>';
        return;
    }

    let html = `
        <table class="table table-hover transaction-table">
            <thead>
                <tr>
                    <th>날짜</th>
                    <th>내용</th>
                    <th>구분</th>
                    <th class="text-end">금액</th>
                </tr>
            </thead>
            <tbody>
    `;

    transactions.forEach(transaction => {
        const date = transaction.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        const type = transaction.type === 'income' ? '수입' : '지출';
        const amount = Number(transaction.amount).toLocaleString();

        html += `
            <tr>
                <td>${date}</td>
                <td>${transaction.description}</td>
                <td>${type}</td>
                <td class="text-end ${transaction.type === 'income' ? 'text-success' : 'text-danger'}">${amount}원</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    transactionList.innerHTML = html;
    console.log('거래내역 표시 완료');
}

// 요약 정보 업데이트
function updateSummary() {
    // 현재 표시된 거래 내역만 사용하여 계산
    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = totalIncome - totalExpense;
    
    // 요약 카드 업데이트
    const summaryHtml = `
        <div class="row">
            <div class="col-md-4 mb-3">
                <div class="card bg-success text-white h-100">
                    <div class="card-body">
                        <h5 class="card-title">총 수입</h5>
                        <p class="card-text">${totalIncome.toLocaleString()}원</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card bg-danger text-white h-100">
                    <div class="card-body">
                        <h5 class="card-title">총 지출</h5>
                        <p class="card-text">${totalExpense.toLocaleString()}원</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card ${balance >= 0 ? 'bg-info' : 'bg-warning'} text-white h-100">
                    <div class="card-body">
                        <h5 class="card-title">잔액</h5>
                        <p class="card-text">${balance.toLocaleString()}원</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const summaryElement = document.getElementById('summary');
    if (summaryElement) {
        summaryElement.innerHTML = summaryHtml;
    }
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

// 연도 필터 옵션 업데이트
function updateYearFilter() {
    const yearFilter = document.getElementById('yearFilter');
    const years = Array.from(availableYears).sort((a, b) => b - a); // 내림차순 정렬
    
    let html = '<option value="">전체 연도</option>';
    years.forEach(year => {
        html += `<option value="${year}">${year}년</option>`;
    });
    
    yearFilter.innerHTML = html;
}

// 월 필터 상태 업데이트
function updateMonthFilter() {
    const monthFilter = document.getElementById('monthFilter');
    const yearFilter = document.getElementById('yearFilter');
    
    if (!yearFilter.value) {
        monthFilter.value = '';
    }
    monthFilter.disabled = !yearFilter.value;
}

// 거래 필터링
async function filterTransactions() {
    try {
        showLoading();
        console.log('필터링 시작 - 현재 연도:', currentYear);
        
        let query = db.collection('transactions');
        
        // 메인 연도 필터 적용
        const startDate = `${currentYear}0101`;
        const endDate = `${currentYear}1231`;
        
        // 월 필터 적용
        const month = document.getElementById('monthFilter').value;
        if (month) {
            const monthStartDate = `${currentYear}${month}01`;
            const monthEndDate = `${currentYear}${month}31`;
            query = query.where('date', '>=', monthStartDate)
                        .where('date', '<=', monthEndDate);
            console.log('월 필터 적용:', monthStartDate, '~', monthEndDate);
        } else {
            query = query.where('date', '>=', startDate)
                        .where('date', '<=', endDate);
            console.log('연도 전체 조회:', startDate, '~', endDate);
        }
        
        const snapshot = await query.get();
        console.log('조회된 데이터 수:', snapshot.size);
        
        transactions = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            transactions.push({
                id: doc.id,
                date: data.date,
                description: data.description,
                type: data.type,
                amount: Number(data.amount)
            });
        });
        
        // 날짜순 정렬
        transactions.sort((a, b) => b.date.localeCompare(a.date));
        
        console.log('처리된 거래 내역:', transactions);
        
        displayTransactions();
        updateSummary();
    } catch (error) {
        console.error('거래 필터링 오류:', error);
        alert('거래 목록을 필터링하는 중 오류가 발생했습니다.');
    } finally {
        hideLoading();
    }
}

// PDF 내보내기 함수
async function exportToPDF(event) {
    if (event) {
        event.stopPropagation();
    }

    // 거래내역이 없는 경우 처리
    if (!transactions || transactions.length === 0) {
        alert('내보낼 거래내역이 없습니다.');
        return;
    }

    // 현재 필터 상태 가져오기
    const year = document.getElementById('yearFilter').value;
    const month = document.getElementById('monthFilter').value;
    
    // PDF 제목 설정
    let title = '거래내역';
    if (year) {
        title += ` (${year}년`;
        if (month) {
            title += ` ${month}월`;
        }
        title += ')';
    }

    // 수입/지출 합계 계산
    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    // PDF로 변환할 임시 요소 생성
    const element = document.createElement('div');
    element.innerHTML = `
        <div style="padding: 20px; font-family: 'Arial', sans-serif;">
            <h2 style="text-align: center; margin-bottom: 20px; color: #333;">${title}</h2>
            
            <div style="margin-bottom: 20px; padding: 10px; background-color: #f8f9fa; border-radius: 5px;">
                <div style="margin-bottom: 5px;">총 수입: ${totalIncome.toLocaleString()}원</div>
                <div style="margin-bottom: 5px;">총 지출: ${totalExpense.toLocaleString()}원</div>
                <div>잔액: ${(totalIncome - totalExpense).toLocaleString()}원</div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">날짜</th>
                        <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">내용</th>
                        <th style="border: 1px solid #dee2e6; padding: 12px; text-align: center;">구분</th>
                        <th style="border: 1px solid #dee2e6; padding: 12px; text-align: right;">금액</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.map(transaction => `
                        <tr>
                            <td style="border: 1px solid #dee2e6; padding: 12px;">${transaction.date}</td>
                            <td style="border: 1px solid #dee2e6; padding: 12px;">${transaction.description}</td>
                            <td style="border: 1px solid #dee2e6; padding: 12px; text-align: center; color: ${transaction.type === 'income' ? '#198754' : '#dc3545'}">
                                ${transaction.type === 'income' ? '수입' : '지출'}
                            </td>
                            <td style="border: 1px solid #dee2e6; padding: 12px; text-align: right; color: ${transaction.type === 'income' ? '#198754' : '#dc3545'}">
                                ${transaction.amount.toLocaleString()}원
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div style="margin-top: 20px; text-align: right; font-size: 12px; color: #6c757d;">
                출력일시: ${new Date().toLocaleString()}
            </div>
        </div>
    `;

    // PDF 옵션 설정
    const opt = {
        margin: [10, 10],
        filename: `${title}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2,
            useCORS: true,
            logging: false
        },
        jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait',
            compress: true
        }
    };

    try {
        showLoading();
        // PDF 생성 및 다운로드
        await html2pdf().set(opt).from(element).save();
    } catch (error) {
        console.error('PDF 생성 오류:', error);
        alert('PDF 생성 중 오류가 발생했습니다.');
    } finally {
        hideLoading();
    }
}

// 메인 연도 필터 초기화 함수
function initMainYearFilter() {
    const mainYearFilter = document.getElementById('mainYearFilter');
    if (!mainYearFilter) return;

    // 현재 연도부터 2020년까지의 옵션 생성
    const currentYear = new Date().getFullYear();
    let html = '';
    for (let year = currentYear; year >= 2020; year--) {
        html += `<option value="${year}">${year}년</option>`;
    }
    mainYearFilter.innerHTML = html;
}

// 메인 연도 변경 함수
async function changeMainYear() {
    const mainYearFilter = document.getElementById('mainYearFilter');
    if (!mainYearFilter) return;

    currentYear = mainYearFilter.value;
    
    // 월 필터 초기화
    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter) {
        monthFilter.value = '';
    }

    // 데이터 다시 로드
    await filterTransactions();
}

// 사용 가능한 연도 업데이트 함수
async function updateAvailableYears() {
    try {
        const snapshot = await db.collection('transactions').get();
        availableYears.clear();
        
        snapshot.docs.forEach(doc => {
            const year = doc.data().date.substring(0, 4);
            availableYears.add(year);
        });
        
        // 연도 필터 업데이트
        const mainYearFilter = document.getElementById('mainYearFilter');
        if (mainYearFilter) {
            const years = Array.from(availableYears).sort((a, b) => b - a); // 내림차순 정렬
            let html = '';
            years.forEach(year => {
                html += `<option value="${year}">${year}년</option>`;
            });
            mainYearFilter.innerHTML = html;
            
            // 현재 연도가 있으면 선택, 없으면 가장 최근 연도 선택
            if (availableYears.has(currentYear)) {
                mainYearFilter.value = currentYear;
            } else if (years.length > 0) {
                currentYear = years[0];
                mainYearFilter.value = currentYear;
            }
        }
    } catch (error) {
        console.error('사용 가능한 연도 업데이트 오류:', error);
    }
}

// 앱 초기화 함수 수정
async function initializeApp() {
    try {
        // Firebase 초기화 확인
        if (!db) {
            console.error('Firebase가 초기화되지 않았습니다.');
            return;
        }

        console.log('앱 초기화 시작');
        await updateAvailableYears();
        await filterTransactions();
        console.log('앱 초기화 완료');
    } catch (error) {
        console.error('앱 초기화 오류:', error);
    }
}

// DOMContentLoaded 이벤트
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM 로드 완료');
    initializeApp();
});
