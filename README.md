# OAQ Website

MAEGNAS / OAQ 정적 홈페이지. GitHub Pages는 `main` 브랜치 루트를 배포합니다.

## 로컬 미리보기

ES 모듈과 3D 모델을 불러오므로 파일을 더블 클릭하지 말고 HTTP 서버로 실행하세요.

```sh
python -m http.server 8000
```

`http://localhost:8000/index.html#deploy`에서 스크롤 시연을 볼 수 있습니다.

## 승인 디자인 v1.0

2026-10-19 사용자 승인. v64의 현재 디자인을 **v1.0 최종 디자인 기준본**으로 확정했습니다. 모델과 모션은 변경하지 않았습니다. Git 태그는 `drone-v1.0`, 승인·파일 해시 정보는 `assets/drone/release.json`에 기록합니다. 후속 디자인 수정은 별도 버전으로 관리합니다.

## 드론 스크롤 구간

- `index.html#system`: 최신 모델로 렌더링한 제품 이미지.
- `index.html#deploy`: 화면을 고정하고 스크롤 위치에 따라 카메라와 암의 접힘을 함께 제어합니다. 역방향 스크롤도 같은 경로를 되짚습니다.
- `assets/drone/scroll.js`, `scroll.css`: 기존 페이지와 분리된 동작 및 스타일.
- `oaq-drone-web.glb`: v64 모델에서 만든 약 23 MB 웹용 사본. 돌출된 축 핀과 기존 로고/도장을 포함합니다.
- `motion.json`: 시점, 중심점, 프레임, 전체 형상 맞춤 범위.
- 모델과 라이브러리는 해당 구간에 접근할 때 불러옵니다. CDN 없이 같은 사이트에서 로드합니다.
- 3D 초기화 실패 또는 데이터 절약 모드에서는 18초 제품 영상을 스크롤에 맞춰 표시합니다. `?fallback=video#deploy`로 확인할 수 있습니다.
- `prefers-reduced-motion`에서는 스크롤 보간을 생략합니다. `Continue` 링크로 긴 모션 구간을 건너뛸 수 있습니다.
- 라이브러리 라이선스: `assets/drone/LICENSE-model-viewer.txt`, `assets/drone/draco/LICENSE.txt`.

웹용 사본은 압축과 일부 메시 단순화를 적용했습니다. 원본 Blender/GLB는 수정하지 않았습니다. 모바일 화면 비율은 브라우저에서 검증했으며 실제 저사양 기기의 성능은 별도 확인이 필요합니다.

하부 탐지기는 v64에서 앞 동체와 같은 무광 차콜 색상·금속성·거칠기로 통일했습니다. 모델의 형상, 축, 애니메이션 데이터는 v63과 같습니다.
