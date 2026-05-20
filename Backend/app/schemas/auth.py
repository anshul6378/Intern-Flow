from typing import Literal

from pydantic import BaseModel, EmailStr, field_validator


class UserRegister(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: Literal["referrer", "candidate", "mentor", "hr", "admin"]
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        """Basic password validation."""
        if not v:
            raise ValueError('Password cannot be empty')
        return v


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