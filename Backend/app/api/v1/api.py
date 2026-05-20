from fastapi import APIRouter

from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.referrals import router as referrals_router
from app.api.v1.routes.joining_form import router as joining_form_router
from app.api.v1.routes.nda import router as nda_router
from app.api.v1.routes.non_worker_id import router as non_worker_router
from app.api.v1.routes.certificate import router as certificate_router

api_router = APIRouter()

api_router.include_router(
    health_router
)

api_router.include_router(
    auth_router
)

api_router.include_router(
    referrals_router
)

api_router.include_router(
    joining_form_router
)

api_router.include_router(
    nda_router
)

api_router.include_router(
    non_worker_router
)

api_router.include_router(
    certificate_router
)