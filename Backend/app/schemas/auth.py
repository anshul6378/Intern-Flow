from typing import Literal

from pydantic import BaseModel, EmailStr, field_validator, model_validator


class UserRegister(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: Literal["referrer", "candidate", "mentor", "hr", "admin"]
    employee_id: str | None = None
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        """Basic password validation."""
        if not v:
            raise ValueError('Password cannot be empty')
        return v

    @field_validator('employee_id')
    @classmethod
    def validate_employee_id(cls, v):
        if v is None:
            return v
        value = v.strip()
        return value or None

    @model_validator(mode='after')
    def validate_referrer_employee_id(self):
        if self.role == 'referrer' and not self.employee_id:
            raise ValueError('Employee ID is required for referrer registration')
        return self


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        """Basic password validation."""
        if not v:
            raise ValueError('Password cannot be empty')
        return v


class ClaimAccountRequest(BaseModel):
    email: EmailStr
    password: str
    role: Literal["candidate", "mentor"] | None = None

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        """Basic password validation."""
        if not v:
            raise ValueError('Password cannot be empty')
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str