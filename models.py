# models.py
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
from flask_bcrypt import Bcrypt
from flask_login import UserMixin
from datetime import datetime
import pytz

db = SQLAlchemy()
bcrypt = Bcrypt()

def current_time_jakarta():
    return datetime.now(pytz.timezone('Asia/Jakarta'))

class UserAuth(db.Model, UserMixin):
    __tablename__ = 'userAuth'
    id = db.Column(db.String(36), primary_key=True)
    username = db.Column(db.String(255), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String)
    token = db.Column(db.String(64), unique=True, nullable=False)
    companyId = db.Column(db.String(36), db.ForeignKey('companyAuth.id'), nullable=False)
    createdAt = db.Column(db.DateTime, nullable=False)
    updatedAt = db.Column(db.DateTime, nullable=False)
    otp = db.Column(db.Integer)
    otpExpiration = db.Column(db.DateTime)
    def get_id(self):
        return self.id
    def set_password(self, password):
        self.password = bcrypt.generate_password_hash(password).decode('utf-8')
    def check_password(self, password):
        return bcrypt.check_password_hash(self.password, password)

class CompanyAuth(db.Model, UserMixin):
    __tablename__ = 'companyAuth'
    id = db.Column(db.String(36), primary_key=True)
    name = db.Column(db.String)
    limit = db.Column(db.Integer)
    usage = db.Column(db.Integer, default=0)
    createdAt = db.Column(db.DateTime, nullable=False)
    updatedAt = db.Column(db.DateTime, nullable=False)

class FaasBs(db.Model):
    __tablename__ = 'faasBs'
    id = db.Column(db.String(36), primary_key=True)
    userId = db.Column(db.String(36), db.ForeignKey('userAuth.id'), nullable=False)
    companyId = db.Column(db.String(36), db.ForeignKey('companyAuth.id'), nullable=False)
    title = db.Column(db.String, nullable=False)
    totalPages = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(255), nullable=False)
    createdAt = db.Column(db.DateTime, nullable=False)
    updatedAt = db.Column(db.DateTime, nullable=False)

class FaasBsPages(db.Model):
    __tablename__ = 'faasBsPages'
    id = db.Column(db.String(40), primary_key=True)
    bsId = db.Column(db.String(36), db.ForeignKey('faasBs.id'), nullable=False)
    source = db.Column(db.String(255), nullable=False)
    bankName = db.Column(db.String(512))
    accountNumber = db.Column(db.String(512))
    accountType = db.Column(db.String(512))
    accountHolderName = db.Column(db.String(512))
    statementPeriode = db.Column(db.String(512))
    currency = db.Column(db.String(512))
    promptUsage = db.Column(db.Integer)
    completionUsage = db.Column(db.Integer)
    createdAt = db.Column(db.DateTime, nullable=False)
    updatedAt = db.Column(db.DateTime, nullable=False)

class FaasBsTransactions(db.Model):
    __tablename__ = 'faasBsTransactions'
    id = db.Column(db.String(50), primary_key=True)
    pageId = db.Column(db.String(40), db.ForeignKey('faasBsPages.id'), nullable=False)
    date = db.Column(db.DateTime, nullable=False)
    description = db.Column(db.String(512), nullable=False)
    type = db.Column(db.String(512), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    balance = db.Column(db.Float)
    createdAt = db.Column(db.DateTime, nullable=False)
    updatedAt = db.Column(db.DateTime, nullable=False)

class FaasBsSubcategories(db.Model):
    __tablename__ = 'faasBsSubcategories'
    id = db.Column(db.String(36), primary_key=True)
    bsId = db.Column(db.String(36), db.ForeignKey('faasBs.id'), nullable=False)
    category = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    createdAt = db.Column(db.DateTime, nullable=False)
    updatedAt = db.Column(db.DateTime, nullable=False)

class FaasBsSubcategoriesKeywords(db.Model):
    __tablename__ = 'faasBsSubcategoriesKeywords'
    id = db.Column(db.String(36), primary_key=True)
    subcategoryId = db.Column(db.String(36), db.ForeignKey('faasBsSubcategories.id'), nullable=False)
    keyword = db.Column(db.String(255), nullable=False)
    createdAt = db.Column(db.DateTime, nullable=False)
    updatedAt = db.Column(db.DateTime, nullable=False)

class FaasFs(db.Model):
    __tablename__ = 'faasFs'
    id = db.Column(db.String(36), primary_key=True)
    userId = db.Column(db.String(36), db.ForeignKey('userAuth.id'), nullable=False)
    companyId = db.Column(db.String(36), db.ForeignKey('companyAuth.id'), nullable=False)
    title = db.Column(db.String, nullable=False)
    companyName = db.Column(db.String(255))
    totalPages = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(255), nullable=False)
    promptUsage = db.Column(db.Integer)
    completionUsage = db.Column(db.Integer)
    createdAt = db.Column(db.DateTime, nullable=False)
    updatedAt = db.Column(db.DateTime, nullable=False)

class FaasFsDocs(db.Model):
    __tablename__ = 'faasFsDocs'
    id = db.Column(db.String(36), primary_key=True)
    fsId = db.Column(db.String(36), db.ForeignKey('faasFs.id'), nullable=False)
    documentType = db.Column(db.String(255))
    lastYear = db.Column(db.String(255))
    currentYear = db.Column(db.String(255))
    createdAt = db.Column(db.DateTime, nullable=False)
    updatedAt = db.Column(db.DateTime, nullable=False)

class FaasFsDocsPages(db.Model):
    __tablename__ = 'faasFsDocsPages'
    id = db.Column(db.String(40), primary_key=True)
    fsDocsId = db.Column(db.String(36), db.ForeignKey('faasFsDocs.id'), nullable=False)
    source = db.Column(db.String(255), nullable=False)
    createdAt = db.Column(db.DateTime, nullable=False)
    updatedAt = db.Column(db.DateTime, nullable=False)

class FaasFsDocsBs(db.Model):
    __tablename__ = 'faasFsDocsBs'
    id = db.Column(db.String(36), primary_key=True)
    fsDocsId = db.Column(db.String(36), db.ForeignKey('faasFsDocs.id'), nullable=False)
    year = db.Column(db.String(255))
    totalCurrentAssets = db.Column(db.String(255))
    totalNonCurrentAssets = db.Column(db.String(255))
    totalAssets = db.Column(db.String(255))
    totalCurrentLiabilities = db.Column(db.String(255))
    totalNonCurrentLiabilities = db.Column(db.String(255))
    totalLiabilities = db.Column(db.String(255))
    totalEquity = db.Column(db.String(255))
    createdAt = db.Column(db.DateTime, nullable=False)
    updatedAt = db.Column(db.DateTime, nullable=False)

class FaasFsDocsIs(db.Model):
    __tablename__ = 'faasFsDocsIs'
    id = db.Column(db.String(36), primary_key=True)
    fsDocsId = db.Column(db.String(40), db.ForeignKey('faasFsDocs.id'), nullable=False)
    year = db.Column(db.String(255))
    revenue = db.Column(db.String(255))
    costOfGoods = db.Column(db.String(255))
    grossProfit = db.Column(db.String(255))
    earningsBeforeTax = db.Column(db.String(255))
    createdAt = db.Column(db.DateTime, nullable=False)
    updatedAt = db.Column(db.DateTime, nullable=False)

class FaasFsDocsCs(db.Model):
    __tablename__ = 'faasFsDocsCs'
    id = db.Column(db.String(36), primary_key=True)
    fsDocsId = db.Column(db.String(40), db.ForeignKey('faasFsDocs.id'), nullable=False)
    year = db.Column(db.String(255))
    netCashFromOperatingActivities	 = db.Column(db.String(255))
    netCashUsedInInvestingActivities = db.Column(db.String(255))
    netCashUsedInFinancingActivities = db.Column(db.String(255))
    createdAt = db.Column(db.DateTime, nullable=False)
    updatedAt = db.Column(db.DateTime, nullable=False)
    
class TradeFinance(db.Model):
    __tablename__ = 'tradeFinance'
    id = db.Column(db.String(36), primary_key=True)
    userId = db.Column(db.String(36), db.ForeignKey('userAuth.id'), nullable=False)
    companyId = db.Column(db.String(36), db.ForeignKey('companyAuth.id'), nullable=False)
    title = db.Column(db.String, nullable=False)
    company = db.Column(db.String(255))
    menu = db.Column(db.String(255))
    totalDocumentTypes = db.Column(db.Integer, nullable=False)
    totalPages = db.Column(db.Integer, nullable=False)
    manualSupervisor = db.Column(db.Boolean, nullable=False)
    status = db.Column(db.String(255), nullable=False)
    promptUsage = db.Column(db.Integer)
    completionUsage = db.Column(db.Integer)
    createdAt = db.Column(db.DateTime, nullable=False)
    updatedAt = db.Column(db.DateTime, nullable=False)

class TfDocs(db.Model):
    __tablename__ = 'tfDocs'
    id = db.Column(db.String(40), primary_key=True)
    tfId = db.Column(db.String(36), db.ForeignKey('tradeFinance.id'), nullable=False)
    main = db.Column(db.Boolean)
    documentType = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(255))
    description = db.Column(db.String(255))
    createdAt = db.Column(db.DateTime, nullable=False)
    updatedAt = db.Column(db.DateTime, nullable=False)
    fieldLCNo = db.Column(db.String(255))
    fieldBeneficiary = db.Column(db.String(255))
    fieldDrawee = db.Column(db.String(255))
    fieldCustomer = db.Column(db.String(255))
    fieldCurrency = db.Column(db.String(255))
    fieldAmount = db.Column(db.String(255))
    fieldTenor = db.Column(db.String(255))
     
class TfDocsPages(db.Model):
    __tablename__ = 'tfDocsPages'
    id = db.Column(db.String(50), primary_key=True)
    tfDocsId = db.Column(db.String(40), db.ForeignKey('tfDocs.id'), nullable=False)
    source = db.Column(db.String(255), nullable=False)
    createdAt = db.Column(db.DateTime, nullable=False)
    updatedAt = db.Column(db.DateTime, nullable=False)

class ApiKey(db.Model):
    __tablename__ = 'apiKey'
    id = db.Column(db.String(36), primary_key=True)
    companyId = db.Column(db.String(36), db.ForeignKey('companyAuth.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    keyPrefix = db.Column(db.String(32), nullable=False)
    keyHash = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(50), default='Active')
    lastUsedAt = db.Column(db.DateTime)
    createdAt = db.Column(db.DateTime, nullable=False)
    updatedAt = db.Column(db.DateTime, nullable=False)

class ApiRequestLog(db.Model):
    __tablename__ = 'apiRequestLog'
    id = db.Column(db.String(36), primary_key=True)
    companyId = db.Column(db.String(36), db.ForeignKey('companyAuth.id'), nullable=False)
    endpoint = db.Column(db.String(255), nullable=False)
    method = db.Column(db.String(10), nullable=False)
    statusCode = db.Column(db.Integer, nullable=False)
    latencyMs = db.Column(db.Integer, nullable=False)
    hitsCount = db.Column(db.Integer, default=1)
    createdAt = db.Column(db.DateTime, nullable=False)

@event.listens_for(CompanyAuth, 'before_insert')
@event.listens_for(UserAuth, 'before_insert')
@event.listens_for(FaasBs, 'before_insert')
@event.listens_for(FaasBsPages, 'before_insert')
@event.listens_for(FaasBsTransactions, 'before_insert')
@event.listens_for(FaasBsSubcategories, 'before_insert')
@event.listens_for(FaasBsSubcategoriesKeywords, 'before_insert')
@event.listens_for(FaasFs, 'before_insert')
@event.listens_for(FaasFsDocs, 'before_insert')
@event.listens_for(FaasFsDocsPages, 'before_insert')
@event.listens_for(FaasFsDocsBs, 'before_insert')
@event.listens_for(FaasFsDocsIs, 'before_insert')
@event.listens_for(FaasFsDocsCs, 'before_insert')
@event.listens_for(TradeFinance, 'before_insert')
@event.listens_for(TfDocs, 'before_insert')
@event.listens_for(TfDocsPages, 'before_insert')
@event.listens_for(ApiKey, 'before_insert')
def set_created_at(mapper, connection, target):
    target.createdAt = current_time_jakarta()
    target.updatedAt = current_time_jakarta()

@event.listens_for(ApiRequestLog, 'before_insert')
def set_log_created_at(mapper, connection, target):
    target.createdAt = current_time_jakarta()

@event.listens_for(CompanyAuth, 'before_update')
@event.listens_for(UserAuth, 'before_update')
@event.listens_for(FaasBs, 'before_update')
@event.listens_for(FaasBsPages, 'before_update')
@event.listens_for(FaasBsTransactions, 'before_update')
@event.listens_for(FaasBsSubcategories, 'before_update')
@event.listens_for(FaasBsSubcategoriesKeywords, 'before_update')
@event.listens_for(FaasFsDocs, 'before_update')
@event.listens_for(FaasFsDocsPages, 'before_update')
@event.listens_for(FaasFsDocsBs, 'before_update')
@event.listens_for(FaasFsDocsIs, 'before_update')
@event.listens_for(FaasFsDocsCs, 'before_update')
@event.listens_for(TradeFinance, 'before_update')
@event.listens_for(TfDocs, 'before_update')
@event.listens_for(TfDocsPages, 'before_update')
@event.listens_for(ApiKey, 'before_update')
def set_updated_at(mapper, connection, target):
    target.updatedAt = current_time_jakarta()