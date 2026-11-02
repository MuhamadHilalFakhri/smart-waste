from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from ..inference import classifier
from ..media import normalize_upload
from ..schemas import PredictionOut
from ..security import current_user

router = APIRouter(
    prefix="/predictions", tags=["predictions"], dependencies=[Depends(current_user)]
)


@router.post("", response_model=PredictionOut)
async def predict(photo: UploadFile = File()):
    result = await run_in_threadpool(classifier.predict, await normalize_upload(photo))
    if result["outcome"] != "predicted":
        raise HTTPException(503, "Prediksi belum tersedia. Pilih kategori secara manual.")
    return result
