let transactions = [];
let currentTransactionId = null;
let receiptModal = null;
let receiptViewModal = null;

document.addEventListener('DOMContentLoaded', function() {
    // Bootstrap 모달 초기화
    receiptModal = new bootstrap.Modal(document.getElementById('receiptModal'));
    receiptViewModal = new bootstrap.Modal(document.getElementById('receiptViewModal'));
    
    // 영수증 뷰어 모달이 닫힐 때 이미지 초기화
    document.getElementById('receiptViewModal').addEventListener('hidden.bs.modal', function () {
        document.getElementById('receiptImage').src = '';
    });

    // 거래 목록에 대한 이벤트 위임 설정
    document.getElementById('transactionList').addEventListener('click', function(e) {
        // 영수증 이미지 클릭 처리
        if (e.target.classList.contains('receipt-thumbnail')) {
            viewReceipt(e.target.getAttribute('data-receipt-url'));
        }
        // 영수증 추가 버튼 클릭 처리
        if (e.target.classList.contains('add-receipt-btn') || 
            e.target.closest('.add-receipt-btn')) {
            const transactionId = parseInt(e.target.closest('.add-receipt-btn').getAttribute('data-transaction-id'));
            openReceiptModal(transactionId);
        }
    });

    // 폼 제출 이벤트 리스너
    document.getElementById('transactionForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const date = document.getElementById('date').value;
        const description = document.getElementById('description').value;
        const type = document.getElementById('type').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const receiptFile = document.getElementById('receipt').files[0];
        
        if (receiptFile) {
            const reader = new FileReader();
            reader.onload = function(e) {
                addTransaction(date, description, type, amount, e.target.result);
            };
            reader.readAsDataURL(receiptFile);
        } else {
            addTransaction(date, description, type, amount, null);
        }
        
        this.reset();
    });

    loadTransactions();
});

function addTransaction(date, description, type, amount, receiptUrl) {
    const transaction = {
        id: Date.now(),
        date,
        description,
        type,
        amount,
        receiptUrl
    };
    
    transactions.push(transaction);
    updateSummary();
    displayTransactions();
    saveTransactions();
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

function viewReceipt(receiptUrl) {
    try {
        document.getElementById('receiptImage').src = receiptUrl;
        if (receiptViewModal) {
            receiptViewModal.show();
        } else {
            receiptViewModal = new bootstrap.Modal(document.getElementById('receiptViewModal'));
            receiptViewModal.show();
        }
    } catch (error) {
        console.error('영수증 보기 오류:', error);
    }
}

function openReceiptModal(transactionId) {
    try {
        currentTransactionId = transactionId;
        if (receiptModal) {
            receiptModal.show();
        } else {
            receiptModal = new bootstrap.Modal(document.getElementById('receiptModal'));
            receiptModal.show();
        }
    } catch (error) {
        console.error('영수증 모달 오류:', error);
    }
}

function updateReceipt() {
    const receiptFile = document.getElementById('receiptUpdate').files[0];
    if (!receiptFile) {
        alert('영수증 파일을 선택해주세요.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const transaction = transactions.find(t => t.id === currentTransactionId);
        if (transaction) {
            transaction.receiptUrl = e.target.result;
            saveTransactions();
            displayTransactions();
            receiptModal.hide();
            document.getElementById('receiptUpdate').value = '';
        }
    };
    reader.readAsDataURL(receiptFile);
}

function filterTransactions() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) return;
    
    const filtered = transactions.filter(t => {
        return t.date >= startDate && t.date <= endDate;
    });
    
    displayTransactions(filtered);
}

function saveTransactions() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

function loadTransactions() {
    const saved = localStorage.getItem('transactions');
    if (saved) {
        transactions = JSON.parse(saved);
        updateSummary();
        displayTransactions();
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
