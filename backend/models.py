from sqlalchemy import Column, Integer, String, Boolean
from db import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    sku = Column(String, unique=True, nullable=False, index=True)
    description = Column(String)
    active = Column(Boolean, default=True)
