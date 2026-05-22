/**
 * 글로벌 안전 검증 정책에 따른 공통 실행/검증 헬퍼
 * [실행(Execute) -> 검증(Verify) -> 결과 보고(Report)] 구조를 강제합니다.
 */

export async function withVerification<T>(
  actionName: string,
  executeFn: () => Promise<T> | T,
  verifyFn: (result: T) => boolean,
  onSuccess?: (result: T) => void,
  onError?: (error: Error) => void
): Promise<T> {
  try {
    // 1. 실행 (Execute)
    const result = await executeFn();
    
    // 2. 검증 (Verify)
    const isValid = verifyFn(result);
    if (!isValid) {
      // 검증 실패 시 즉시 에러 발생 (성공 메시지 원천 차단)
      throw new Error(`[Verify Error] ${actionName} 데이터 검증 실패. 저장된 데이터가 무결하지 않습니다.`);
    }

    // 3. 결과 보고 (Report) - 성공 시에만 로그 및 콜백 실행
    console.log(`[SUCCESS] ${actionName} 실행 및 검증 완료.`);
    if (onSuccess) {
      onSuccess(result);
    }
    
    return result;
  } catch (error) {
    // 에러 처리: 실패했는데 SUCCESS가 뜨는 상황 방지
    const errObj = error instanceof Error ? error : new Error(String(error));
    console.error(`[FAILED] ${actionName} 처리 중 오류 발생:`, errObj.message);
    
    if (onError) {
      onError(errObj);
    }
    
    throw errObj;
  }
}
