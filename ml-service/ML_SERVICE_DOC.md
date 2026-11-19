# Tài Liệu ML Service — Giải Thích Từ Đầu

> Tài liệu này dành cho người chưa biết gì về Machine Learning hay Python.  
> Mỗi khái niệm đều được giải thích theo cách dễ hiểu nhất có thể.

---

## 1. ML Service là gì? Tại sao cần nó?

Hãy tưởng tượng bạn đang bán vé concert. Bạn muốn biết:

- **"Ai đang cố mua 50 vé trong 10 phút? Có phải bot không?"** → Phát hiện gian lận
- **"Sự kiện này có bán hết vé không? Bao giờ hết?"** → Dự đoán nhu cầu
- **"Giá vé nên tăng lên bao nhiêu khi sự kiện sắp diễn ra?"** → Định giá động

Những câu hỏi này **quá phức tạp** để viết bằng code thông thường (if/else). Vì vậy, người ta dùng **Machine Learning (ML)** — tức là cho máy tính "học" từ dữ liệu để tự trả lời những câu đó.

ML Service là một **dịch vụ riêng biệt** (tách khỏi NestJS backend), viết bằng **Python + FastAPI**, chuyên làm 3 việc:

| Chức năng | Mục đích |
|---|---|
| Fraud Detection (Phát hiện gian lận) | Tìm user đáng ngờ |
| Demand Forecasting (Dự báo nhu cầu) | Dự đoán sẽ bán bao nhiêu vé |
| Dynamic Pricing (Định giá động) | Gợi ý giá vé tối ưu |

---

## 2. Kiến Trúc Tổng Quan

```
┌─────────────────────────────────┐
│        NestJS Backend           │  ← API chính, xử lý đặt vé, auth...
│        (Port 3001)              │
└──────────────┬──────────────────┘
               │ gọi HTTP
               ▼
┌─────────────────────────────────┐
│        ML Service               │  ← Dịch vụ ML (file này giải thích)
│        (Port 8000)              │
└──────────────┬──────────────────┘
               │ đọc trực tiếp
               ▼
┌─────────────────────────────────┐
│     PostgreSQL Database         │  ← Cùng 1 DB với NestJS
└─────────────────────────────────┘
```

**Tại sao tách riêng?** Vì Python có nhiều thư viện ML tốt hơn Node.js (scikit-learn, numpy...). NestJS lo chuyện kinh doanh, Python lo chuyện "tư duy thông minh".

---

## 3. Các File và Vai Trò

```
ml-service/
├── app/
│   ├── main.py          # Điểm khởi động, cấu hình server
│   ├── config.py        # Đọc biến môi trường (.env)
│   ├── database.py      # Kết nối PostgreSQL
│   ├── models_db.py     # Mô tả cấu trúc bảng database
│   ├── routes.py        # Các API endpoint (URL)
│   ├── fraud_model.py   # Model phát hiện gian lận
│   ├── demand_model.py  # Model dự báo nhu cầu
│   └── pricing_model.py # Model định giá động
├── models/              # Thư mục lưu file model đã train
├── requirements.txt     # Danh sách thư viện Python cần cài
└── Dockerfile           # Cấu hình để chạy bằng Docker
```

---

## 4. Khái Niệm Cốt Lõi Cần Biết

### 4.1. "Train" (Học) là gì?

Giống như dạy học sinh: bạn đưa cho máy **rất nhiều ví dụ có sẵn** (dữ liệu đặt vé, hủy vé, thanh toán...) và máy **tự tìm ra quy luật**. Sau khi học xong, máy có thể **đưa ra dự đoán** cho dữ liệu mới.

### 4.2. "Features" (Đặc trưng) là gì?

Là các con số mô tả một tình huống. Ví dụ, để đánh giá user có gian lận không, ta cần biết:
- Họ đặt bao nhiêu vé trong 10 phút qua?
- Tỷ lệ hủy đặt của họ là bao nhiêu?
- Họ thường đặt lúc mấy giờ?

Mỗi con số đó là một "feature".

### 4.3. "Model" là gì?

Là "bộ não" của ML sau khi đã học xong — được lưu vào file `.joblib` trong thư mục `models/`. Khi cần dự đoán, ta load file này lên và dùng.

### 4.4. "Scaler" (Chuẩn hóa) là gì?

Các features có đơn vị khác nhau (ví dụ: giá vé = 500.000đ, tỷ lệ hủy = 0.3). Nếu không chuẩn hóa, máy sẽ bị "lệch" vì con số lớn hơn ảnh hưởng nhiều hơn. `StandardScaler` biến tất cả về cùng một thang đo.

---

## 5. File `config.py` — Cấu Hình

```python
class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://..."  # Địa chỉ kết nối DB
    MODEL_DIR: str = ".../models"           # Nơi lưu model
    RETRAIN_INTERVAL_HOURS: int = 6         # Cứ 6 tiếng train lại
    PORT: int = 8000                        # Service chạy ở cổng 8000
```

**Giải thích:** File này đọc các cài đặt từ file `.env`. Nếu không có `.env`, nó dùng giá trị mặc định. Đặc biệt, `RETRAIN_INTERVAL_HOURS = 6` có nghĩa là **cứ 6 tiếng, toàn bộ model sẽ được train lại** với dữ liệu mới nhất — điều này quan trọng vì dữ liệu thực tế luôn thay đổi.

---

## 6. File `database.py` — Kết Nối Database

```python
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=5,        # Giữ sẵn 5 kết nối
    max_overflow=10,    # Tối đa thêm 10 kết nối khi cần
    pool_pre_ping=True, # Kiểm tra kết nối còn sống trước khi dùng
)
```

**Giải thích:** Dùng **SQLAlchemy** (thư viện Python phổ biến nhất để làm việc với database) để kết nối vào cùng PostgreSQL database với NestJS. ML service **chỉ đọc** dữ liệu, không ghi gì vào DB.

**Connection Pool** là gì? Thay vì mở/đóng kết nối DB mỗi lần query (chậm), ta giữ sẵn một "hồ" (`pool`) các kết nối đang mở, dùng xong trả lại hồ.

---

## 7. File `models_db.py` — Mô Tả Bảng Database

File này **ánh xạ** các bảng PostgreSQL thành Python class, chỉ lấy các cột cần thiết cho ML:

```python
class Event(Base):
    __tablename__ = "events"
    id = Column(String, ...)
    name = Column(String)
    status = Column(...)   # DRAFT, ON_SALE, SOLD_OUT, COMPLETED...
    event_date = Column(...)
    total_tickets = Column(Integer)
    available_tickets = Column(Integer)
```

**Tại sao cần file này?** NestJS dùng Prisma để quản lý DB. Python dùng SQLAlchemy. Hai thứ khác nhau nhưng cùng 1 DB. File này giúp Python "hiểu" cấu trúc bảng mà không cần copy toàn bộ schema của Prisma.

---

## 8. File `fraud_model.py` — Phát Hiện Gian Lận

### 8.1. Vấn đề cần giải quyết

Trong hệ thống bán vé, có các hành vi gian lận phổ biến:
- **Scalper bot:** tự động mua hàng loạt vé để bán lại giá cao
- **Account fraud:** tạo nhiều tài khoản để lách giới hạn mua
- **Payment fraud:** thử nhiều thẻ tín dụng bị đánh cắp

### 8.2. 8 Features được trích xuất cho mỗi user

| Feature | Ý nghĩa | Dấu hiệu đáng ngờ |
|---|---|---|
| `booking_velocity_10m` | Số đặt vé trong 10 phút | > 5 → rất đáng ngờ |
| `cancel_ratio` | Tỷ lệ hủy / tổng đặt | > 80% → bất thường |
| `payment_fail_ratio` | Tỷ lệ thanh toán thất bại | > 50% → thử thẻ stolen |
| `total_tickets_30d` | Tổng vé mua trong 30 ngày | > 20 → scalper |
| `night_booking_ratio` | % đặt vé lúc 2-5 giờ sáng | Cao → bot (không ngủ) |
| `avg_amount` | Số tiền trung bình mỗi lần đặt | Quá cao hoặc quá thấp |
| `unique_events` | Số sự kiện khác nhau đã đặt | Nhiều → bình thường |
| `days_since_first_booking` | Số ngày từ lần đặt đầu tiên | Mới tạo tài khoản = rủi ro |

### 8.3. Thuật toán: Isolation Forest

**Giải thích đơn giản:** Tưởng tượng bạn có 1000 user. 95% là bình thường, 5% là bất thường. Isolation Forest tìm những user "khác biệt" bằng cách xây dựng nhiều cây quyết định ngẫu nhiên. User bất thường sẽ bị "cô lập" (isolated) sớm hơn trong cây → điểm số thấp hơn.

**Đây là học không có giám sát (unsupervised):** Không cần dữ liệu đánh nhãn "đây là gian lận, đây không phải". Máy tự tìm ra những gì bất thường trong đám đông.

```python
self.model = IsolationForest(
    n_estimators=200,      # Xây 200 cây quyết định
    contamination=0.05,    # Ước tính ~5% dữ liệu là bất thường
    random_state=42,       # Seed ngẫu nhiên (để kết quả ổn định)
)
```

### 8.4. Kết quả trả về

```json
{
  "userId": "abc123",
  "riskScore": 75,        // 0-100, cao = rủi ro cao
  "riskLevel": "HIGH",    // LOW / MEDIUM / HIGH / CRITICAL
  "recommendation": "REVIEW",  // ALLOW / REVIEW / BLOCK
  "signals": [
    {
      "signal": "VELOCITY",
      "weight": 30,
      "value": 0.8,
      "description": "5 bookings in last 10min"
    }
  ]
}
```

**Ngưỡng quyết định:**
- Score < 50 → `ALLOW` (cho phép bình thường)
- Score 50-69 → `REVIEW` (cần xem xét thủ công)
- Score ≥ 70 → `BLOCK` (chặn lại)

---

## 9. File `demand_model.py` — Dự Báo Nhu Cầu

### 9.1. Vấn đề cần giải quyết

Ban tổ chức cần biết:
- Sự kiện này có bán hết vé không?
- Nếu có, bao giờ hết?
- Nên làm gì tiếp theo (tăng giá? chạy quảng cáo?)?

### 9.2. 12 Features cho mỗi sự kiện

| Feature | Ý nghĩa | Tại sao quan trọng |
|---|---|---|
| `fill_rate` | % ghế đã bán (0.0 → 1.0) | Chỉ báo trực tiếp nhu cầu |
| `days_to_event` | Số ngày đến sự kiện | Gần ngày → mọi người mua gấp |
| `velocity_1h` | Số vé bán trong 1 giờ qua | Nhu cầu ngay lúc này |
| `velocity_24h` | Số vé bán trong 24 giờ qua | Xu hướng ngắn hạn |
| `velocity_7d` | Số vé bán trong 7 ngày qua | Xu hướng dài hạn |
| `velocity_trend` | 24h gần đây / 24h trước đó | Tăng hay giảm? |
| `avg_ticket_price` | Giá vé trung bình | Sự kiện đắt thường bán chậm hơn |
| `tier_count` | Số loại vé | Nhiều loại = nhiều lựa chọn |
| `hour_sin/cos` | Giờ hiện tại (dạng vòng tròn) | Người mua nhiều hơn vào buổi tối |
| `dow_sin/cos` | Ngày trong tuần (dạng vòng tròn) | Cuối tuần mua nhiều hơn |

> **Tại sao dùng sin/cos cho giờ và ngày?**  
> Giờ 23 và giờ 0 thực ra rất gần nhau (cách 1 giờ), nhưng nếu dùng số thẳng (23 và 0), máy sẽ nghĩ chúng cách nhau 23 đơn vị. Biểu diễn dạng sin/cos tạo ra đường tròn liên tục, không có "vách ngăn".

### 9.3. Hai thuật toán được dùng

**Gradient Boosting Regressor** → Dự đoán "sẽ bán thêm bao nhiêu vé trong 24h tới?"

Đây là thuật toán học có giám sát (supervised). Nó xây dựng nhiều cây quyết định nhỏ, mỗi cây sửa lỗi của cây trước đó — giống như một đội người cùng giải quyết vấn đề, mỗi người bù đắp điểm yếu của đội trước.

**Logistic Regression** → Dự đoán "xác suất bán hết vé là bao nhiêu %?"

Đây là thuật toán phân loại đơn giản nhưng hiệu quả cho bài toán nhị phân (bán hết / không bán hết).

### 9.4. Data Augmentation (Tăng cường dữ liệu)

```python
# Với mỗi sự kiện thực tế, tạo thêm 5 trường hợp giả:
for sim_fill in [0.1, 0.3, 0.5, 0.7, 0.9]:
    sim_features = feature_vec.copy()
    sim_features[0] = sim_fill  # Giả sử fill_rate khác nhau
```

**Tại sao cần làm vậy?** Vì dữ liệu thực tế thường ít. Nếu chỉ có 10 sự kiện, mô hình sẽ học kém. Bằng cách tạo thêm các kịch bản giả định hợp lý, ta có nhiều dữ liệu hơn để train.

### 9.5. Kết quả trả về

```json
{
  "eventId": "evt_123",
  "currentSold": 750,
  "totalCapacity": 1000,
  "fillRate": 0.75,
  "predictedSoldIn24h": 820,    // Dự đoán sau 24h
  "predictedSoldIn72h": 950,    // Dự đoán sau 72h
  "predictedSelloutDate": "2025-12-01T18:00:00Z",
  "selloutProbability": 0.87,   // 87% khả năng bán hết
  "velocity": {
    "ticketsPerHour": 4.2,
    "trend": "ACCELERATING"     // ACCELERATING / STEADY / DECELERATING / STALLED
  },
  "recommendations": [
    "HIGH SELLOUT PROBABILITY — consider increasing prices"
  ]
}
```

### 9.6. Heatmap nhu cầu

Tính toán **khi nào** người dùng hay đặt vé:
- Theo giờ trong ngày (0-23h)
- Theo ngày trong tuần (Thứ 2-CN)

→ Giúp ban tổ chức biết thời điểm tốt nhất để chạy quảng cáo.

---

## 10. File `pricing_model.py` — Định Giá Động

### 10.1. Vấn đề cần giải quyết

Giá vé cố định không tối ưu. Ví dụ:
- Sự kiện sắp diễn ra, còn 200 vé, nhưng giá vẫn thấp → mất doanh thu
- Sự kiện còn 6 tháng, vừa mở bán, giá cao → không ai mua

**Định giá động** điều chỉnh giá dựa trên cung-cầu thực tế, giống như vé máy bay hoặc Uber surge pricing.

### 10.2. 7 Features cho mỗi tier vé

| Feature | Ý nghĩa |
|---|---|
| `fill_rate` | % tổng sự kiện đã bán |
| `days_to_event` | Số ngày đến sự kiện |
| `velocity_24h` | Tốc độ bán trong 24h |
| `base_price` | Giá gốc của tier này |
| `tier_fill_rate` | % tier cụ thể này đã bán |
| `avg_event_price` | Giá trung bình tất cả tier |
| `competitor_ratio` | Giá tier này / giá trung bình (so sánh tương đối) |

### 10.3. Công thức tính giá gợi ý

```
Giá gợi ý = Giá gốc × Hệ số nhân (0.7 ~ 2.0)
```

Hệ số nhân được tính bởi 4 yếu tố:
- **Fill factor (35%):** Nhiều người mua → hệ số tăng
- **Velocity factor (30%):** Đặt vé nhanh → hệ số tăng  
- **Time factor (25%):** Gần ngày diễn → hệ số tăng
- **Category factor (10%):** Chưa dùng (placeholder)

Ví dụ thực tế:
```
Vé VIP giá gốc: 500.000đ
Sự kiện còn 2 ngày, đã bán 92%, đang bán 30 vé/ngày
→ Hệ số: 1.0 × 1.3 (fill) × 1.3 (velocity) × 1.3 (time) ≈ 1.65
→ Giá gợi ý: 825.000đ
```

### 10.4. Cách tránh giá quá cao hoặc quá thấp

```python
multiplier = max(0.7, min(2.0, multiplier))
```

Luôn giữ hệ số trong khoảng 0.7–2.0, tức là giá không bao giờ giảm quá 30% hay tăng quá 100% so với giá gốc.

---

## 11. File `routes.py` — Các API Endpoint

Đây là "cửa ra vào" của ML service. NestJS gọi những URL này:

| Method | URL | Chức năng |
|---|---|---|
| `GET` | `/api/ml/health` | Kiểm tra service còn sống không, model đã load chưa |
| `POST` | `/api/ml/train/all` | Train lại tất cả model ngay lập tức |
| `POST` | `/api/ml/train/fraud` | Train lại model gian lận |
| `POST` | `/api/ml/train/demand` | Train lại model nhu cầu |
| `POST` | `/api/ml/train/pricing` | Train lại model giá |
| `GET` | `/api/ml/fraud/analyze/{userId}` | Phân tích rủi ro 1 user |
| `GET` | `/api/ml/fraud/report` | Báo cáo toàn bộ user đáng ngờ (24h qua) |
| `GET` | `/api/ml/forecast/{eventId}` | Dự báo nhu cầu sự kiện |
| `GET` | `/api/ml/forecast/{eventId}/heatmap` | Heatmap thời điểm mua vé |
| `GET` | `/api/ml/pricing/{eventId}` | Gợi ý giá cho tất cả tier |
| `GET` | `/api/ml/pricing/{eventId}/tier/{tierId}` | Gợi ý giá cho 1 tier cụ thể |
| `GET` | `/api/ml/models/status` | Xem trạng thái và kích thước các file model |

---

## 12. File `main.py` — Khởi Động Service

### 12.1. Lifecycle (Vòng đời)

```
Khởi động
    ↓
Kết nối DB
    ↓
Train tất cả model lần đầu (nếu chưa có file .joblib)
    ↓
Lên lịch train lại tự động mỗi 6 tiếng
    ↓
Chạy server tại port 8000
    ↓
[Service đang chạy, nhận request từ NestJS]
    ↓
Shutdown → dừng scheduler
```

### 12.2. Tự động train lại (APScheduler)

```python
scheduler.add_job(
    scheduled_retrain,
    "interval",
    hours=settings.RETRAIN_INTERVAL_HOURS,  # Mặc định: 6 giờ
)
```

**Tại sao cần train lại?** Dữ liệu thay đổi theo thời gian: có thêm sự kiện mới, thêm user mới, mẫu hành vi thay đổi. Model cũ sẽ kém chính xác dần, nên cần cập nhật định kỳ.

### 12.3. CORS

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
)
```

Chỉ cho phép NestJS (port 3001) và frontend (port 3000) truy cập. Các nguồn khác sẽ bị từ chối.

---

## 13. Luồng Hoạt Động Thực Tế

### Khi user đặt vé (Fraud Check)

```
User bấm "Đặt vé"
    ↓
NestJS nhận request
    ↓
NestJS gọi ML Service: GET /api/ml/fraud/analyze/{userId}
    ↓
ML Service truy vấn DB: lấy lịch sử đặt vé của user
    ↓
Tính 8 features → chạy qua Isolation Forest
    ↓
Trả về riskScore và recommendation (ALLOW/REVIEW/BLOCK)
    ↓
NestJS quyết định cho phép hay chặn
```

### Khi admin xem dashboard (Demand + Pricing)

```
Admin vào trang quản lý sự kiện
    ↓
Frontend gọi NestJS API
    ↓
NestJS gọi ML Service: GET /api/ml/forecast/{eventId}
    ↓
ML Service tính 12 features → chạy Gradient Boosting
    ↓
Trả về dự báo, xác suất bán hết, recommendations
    ↓
NestJS gọi thêm: GET /api/ml/pricing/{eventId}
    ↓
ML Service tính giá gợi ý từng tier
    ↓
Hiển thị dashboard cho admin
```

---

## 14. Cách Chạy ML Service

### Cách 1: Chạy trực tiếp bằng Python

```bash
# Vào thư mục ml-service
cd ml-service

# Cài thư viện
pip install -r requirements.txt

# Tạo file .env (copy từ example hoặc NestJS)
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ticket_booking

# Chạy
python -m app.main
```

### Cách 2: Dùng PowerShell script

```powershell
.\start.ps1
```

### Cách 3: Docker

```bash
docker build -t ml-service .
docker run -p 8000:8000 --env-file .env ml-service
```

### Kiểm tra hoạt động

```bash
curl http://localhost:8000/api/ml/health
```

Kết quả mong đợi:
```json
{
  "status": "healthy",
  "models": {
    "fraud": "loaded",
    "demand": "loaded",
    "pricing": "loaded"
  }
}
```

---

## 15. File `requirements.txt` — Thư Viện Cần Thiết

| Thư viện | Dùng để làm gì |
|---|---|
| `fastapi` | Framework để tạo HTTP API (comme NestJS nhưng là Python) |
| `uvicorn` | Server chạy FastAPI |
| `sqlalchemy` | Kết nối và query PostgreSQL |
| `scikit-learn` | Thư viện ML: Isolation Forest, Gradient Boosting, Logistic Regression... |
| `numpy` | Xử lý mảng số, tính toán nhanh |
| `joblib` | Lưu/load model ML vào/từ file |
| `apscheduler` | Lên lịch chạy tự động (train lại mỗi 6h) |
| `pydantic-settings` | Đọc cấu hình từ .env |
| `psycopg2-binary` | Driver kết nối PostgreSQL |

---

## 16. Các Điểm Thú Vị Về Thiết Kế

### Singleton Pattern

Mỗi model chỉ có **một instance duy nhất** trong toàn bộ service:

```python
# Cuối mỗi file model:
fraud_model = FraudModel()   # Tạo 1 lần khi import
demand_model = DemandModel()
pricing_model = PricingModel()
```

Tại sao? Vì load model từ file tốn thời gian. Tạo 1 lần và tái sử dụng cho tất cả request.

### Fallback khi chưa có model

Nếu chưa có file model (lần chạy đầu tiên trước khi train xong), code không crash mà dùng **heuristic** (công thức toán học đơn giản) để trả kết quả tạm:

```python
if self.model is None:
    return self._heuristic_score(features, user_id)  # Dùng công thức đơn giản
```

### Lưu model sau khi train

```python
joblib.dump(self.model, "models/fraud_model.joblib")
```

Lần sau khi khởi động lại, service load ngay model đã train, không cần train lại từ đầu (tiết kiệm thời gian và tài nguyên).

---

## 17. Tóm Tắt Trong 5 Dòng

1. **ML Service là Python microservice** chạy riêng ở port 8000, NestJS gọi nó qua HTTP.
2. **3 chức năng chính:** phát hiện gian lận, dự báo nhu cầu, định giá động.
3. **Đọc dữ liệu từ cùng PostgreSQL** như NestJS, nhưng chỉ đọc, không ghi.
4. **Train model tự động mỗi 6 tiếng**, lưu vào file `.joblib`, load lại khi khởi động.
5. **Có fallback heuristic** nếu model chưa được train — service không bao giờ crash hoàn toàn.
