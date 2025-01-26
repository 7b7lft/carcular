<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>교회 회계 장부</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="styles.css">
    <style>
        .spinner-border {
            width: 1rem;
            height: 1rem;
            margin-right: 0.5rem;
        }
    </style>
</head>
<body class="bg-light">
    <div class="container py-4">
        <h1 class="text-center mb-4">교회 회계 장부</h1>
        
        <div class="card shadow-sm mb-4">
            <div class="card-body">
                <h2 class="card-title h4" id="formTitle">새로운 항목 추가</h2>
                <form id="transactionForm" class="row g-3">
                    <div class="col-md-6 col-lg-3">
                        <label for="date" class="form-label">날짜</label>
                        <input type="date" class="form-control" id="date" required>
                    </div>
                    <div class="col-md-6 col-lg-2">
                        <label for="type" class="form-label">구분</label>
                        <select class="form-select" id="type" required>
                            <option value="수입">수입</option>
                            <option value="지출">지출</option>
                        </select>
                    </div>
                    <div class="col-md-6 col-lg-3">
                        <label for="description" class="form-label">내역</label>
                        <input type="text" class="form-control" id="description" placeholder="내역" required>
                    </div>
                    <div class="col-md-6 col-lg-2">
                        <label for="amount" class="form-label">금액</label>
                        <div class="input-group">
                            <input type="text" 
                                   class="form-control" 
                                   id="amount" 
                                   placeholder="금액" 
                                   required 
                                   pattern="[0-9,]*"
                                   oninput="formatAmount(this)"
                                   onblur="this.value = this.value.replace(/[^\d]/g, '')"
                                   style="-webkit-appearance: none; -moz-appearance: textfield; appearance: textfield;">
                            <span class="input-group-text">원</span>
                        </div>
                    </div>
                    <div class="col-md-8 col-lg-2">
                        <label for="receipt" class="form-label">영수증</label>
                        <input type="file" class="form-control" id="receipt" accept="image/*">
                    </div>
                    <div class="col-12">
                        <div class="d-grid gap-2 d-md-flex justify-content-md-start">
                            <button type="submit" id="submitBtn" class="btn btn-primary">추가</button>
                            <button type="button" id="cancelBtn" class="btn btn-secondary" onclick="cancelEdit()" style="display: none;">취소</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <div class="row mb-4">
            <div class="col-md-4 mb-3">
                <div class="card shadow-sm h-100">
                    <div class="card-body">
                        <h3 class="h5">현재 잔액</h3>
                        <p class="h3" id="totalBalance">0원</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card shadow-sm h-100">
                    <div class="card-body">
                        <h3 class="h5">총 수입</h3>
                        <p class="h3 text-success" id="totalIncome">0원</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card shadow-sm h-100">
                    <div class="card-body">
                        <h3 class="h5">총 지출</h3>
                        <p class="h3 text-danger" id="totalExpense">0원</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="card shadow-sm">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h2 class="card-title h4 mb-0">거래 내역</h2>
                    <div class="d-flex gap-2">
                        <select id="yearFilter" class="form-select form-select-sm" style="width: auto;">
                            <option value="">전체 년도</option>
                        </select>
                        <select id="monthFilter" class="form-select form-select-sm" style="width: auto;">
                            <option value="">전체 월</option>
                        </select>
                    </div>
                </div>
                <div class="table-responsive d-none d-md-block">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>날짜</th>
                                <th>구분</th>
                                <th>내역</th>
                                <th>금액</th>
                                <th>영수증</th>
                                <th>작업</th>
                            </tr>
                        </thead>
                        <tbody id="desktopTransactionList"></tbody>
                    </table>
                </div>
                <div class="d-md-none" id="mobileTransactionList"></div>
                
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <div class="d-flex align-items-center">
                        <select id="pageSize" class="form-select form-select-sm me-2" style="width: auto;">
                            <option value="10">10개씩</option>
                            <option value="20">20개씩</option>
                            <option value="30">30개씩</option>
                        </select>
                        <span class="text-muted small">총 <span id="totalItems">0</span>개</span>
                    </div>
                    <nav aria-label="거래내역 페이지 탐색">
                        <ul class="pagination pagination-sm mb-0" id="pagination"></ul>
                    </nav>
                </div>
            </div>
        </div>
    </div>

    <!-- 영수증 모달 -->
    <div class="modal fade" id="receiptModal" tabindex="-1" aria-labelledby="receiptModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="receiptModalLabel">영수증 이미지</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body text-center">
                    <img id="modalReceiptImage" src="" alt="영수증" style="max-width: 100%; max-height: 80vh;">
                </div>
            </div>
        </div>
    </div>

    <!-- 수정 모달 -->
    <div class="modal fade" id="editModal" tabindex="-1" aria-labelledby="editModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="editModalLabel">거래 내역 수정</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <form id="editForm" class="row g-3">
                        <div class="col-md-6">
                            <label for="editDate" class="form-label">날짜</label>
                            <input type="date" class="form-control" id="editDate" required>
                        </div>
                        <div class="col-md-6">
                            <label for="editType" class="form-label">구분</label>
                            <select class="form-select" id="editType" required>
                                <option value="수입">수입</option>
                                <option value="지출">지출</option>
                            </select>
                        </div>
                        <div class="col-12">
                            <label for="editDescription" class="form-label">내역</label>
                            <input type="text" class="form-control" id="editDescription" required>
                        </div>
                        <div class="col-md-6">
                            <label for="editAmount" class="form-label">금액</label>
                            <div class="input-group">
                                <input type="text" 
                                       class="form-control" 
                                       id="editAmount" 
                                       required 
                                       pattern="[0-9,]*"
                                       oninput="formatAmount(this)"
                                       onblur="this.value = this.value.replace(/[^\d]/g, '')"
                                       style="-webkit-appearance: none; -moz-appearance: textfield; appearance: textfield;">
                                <span class="input-group-text">원</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label for="editReceipt" class="form-label">영수증</label>
                            <input type="file" class="form-control" id="editReceipt" accept="image/*">
                        </div>
                        <div id="currentReceiptPreview" class="col-12"></div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">취소</button>
                    <button type="button" class="btn btn-primary" onclick="saveEdit()">저장</button>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js"></script>
    <script src="script.js"></script>
</body>
</html>
