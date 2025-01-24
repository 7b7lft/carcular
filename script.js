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

let db;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log('Firebase 초기화 성공');
} catch (error) {
    console.error('Firebase 초기화 오류:', error);
}

// 전역 변수
let currentYear = new Date().getFullYear().toString();
let transactions = [];
let availableYears = new Set();

// 로딩 표시 함수
function showLoading() {
    // 로딩 표시 구현
}

function hideLoading() {
    // 로딩 숨김 구현
}

// 사용 가능한 연도 업데이트
async function updateAvailableYears() {
    try {
        const snapshot = await db.collection('transactions').get();
        availableYears.clear();
        
        snapshot.forEach(doc => {
            const year = doc.data().date.substring(0, 4);
            availableYears.add(year);
        });
        
        const mainYearFilter = document.getElementById('mainYearFilter');
        if (mainYearFilter) {
            const years = Array.from(availableYears).sort((a, b) => b - a);
            mainYearFilter.innerHTML = years.map(year => 
                `<option value="${year}">${year}년</option>`
            ).join('');
            
            if (years.length > 0) {
                currentYear = years[0];
                mainYearFilter.value = currentYear;
            }
        }
    } catch (error) {
        console.error('연도 업데이트 오류:', error);
    }
}

// 거래 내역 필터링
async function filterTransactions() {
    try {
        showLoading();
        
        const startDate = `${currentYear}0101`;
        const endDate = `${currentYear}1231`;
        
        let query = db.collection('transactions');
        const month = document.getElementById('monthFilter').value;
        
        if (month) {
            query = query.where('date', '>=', `${currentYear}${month}01`)
                        .where('date', '<=', `${currentYear}${month}31`);
        } else {
            query = query.where('date', '>=', startDate)
                        .where('date', '<=', endDate);
        }
        
        const snapshot = await query.get();
        transactions = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            transactions.push({
                id: doc.id,
                date: data.date,
                description: data.description,
                type: data.type,
                amount: parseInt(data.amount)
            });
        });
        
        transactions.sort((a, b) => b.date.localeCompare(a.date));
        
        displayTransactions();
        updateSummary();
    } catch (error) {
        console.error('거래 필터링 오류:', error);
    } finally {
        hideLoading();
    }
}

// 거래 내역 표시
function displayTransactions() {
    const transactionList = document.getElementById('transactionList');
    if (!transactionList) return;

    if (transactions.length === 0) {
        transactionList.innerHTML = '<p class="text-center my-3">거래 내역이 없습니다.</p>';
        return;
    }

    const html = `
        <table class="table table-hover">
            <thead>
                <tr>
                    <th>날짜</th>
                    <th>내용</th>
                    <th>구분</th>
                    <th class="text-end">금액</th>
                </tr>
            </thead>
            <tbody>
                ${transactions.map(transaction => `
                    <tr>
                        <td>${transaction.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}</td>
                        <td>${transaction.description}</td>
                        <td>${transaction.type === 'income' ? '수입' : '지출'}</td>
                        <td class="text-end ${transaction.type === 'income' ? 'text-success' : 'text-danger'}">
                            ${transaction.amount.toLocaleString()}원
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

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
    
    const summaryElement = document.getElementById('summary');
    if (summaryElement) {
        summaryElement.innerHTML = `
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
    }
}

// 연도 변경 처리
async function changeMainYear() {
    const mainYearFilter = document.getElementById('mainYearFilter');
    if (!mainYearFilter) return;

    currentYear = mainYearFilter.value;
    
    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter) {
        monthFilter.value = '';
    }

    await filterTransactions();
}

// 앱 초기화
async function initializeApp() {
    try {
        await updateAvailableYears();
        await filterTransactions();
    } catch (error) {
        console.error('앱 초기화 오류:', error);
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', initializeApp);
