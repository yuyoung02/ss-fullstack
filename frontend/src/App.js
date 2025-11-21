// src/App.js
import { useState } from 'react';
import { SearchBar } from './components/SearchBar';
import { SafetyScore } from './components/SafetyScore';
import { AccessibilityScore } from './components/AccessibilityScore';
import { ConvenienceScore } from './components/ConvenienceScore';
import { TransportInfo } from './components/TransportInfo';
import { Hero } from './components/Hero';
import { SafetyHeatMap } from './components/SafetyHeatMap';
import { Header } from './components/Header';
import { LocationSidebar } from './components/LocationSidebar';
import { ComparisonView } from './components/ComparisonView';
import { Button } from './components/ui/button';
import { LayoutGrid, List } from 'lucide-react';
import { API_BASE_URL } from './apiConfig';

// 주소 → 도시 판별 함수
function detectCityByLatLng(lat, lng) {
  if (lat > 41 && lat < 42.5 && lng < -87 && lng > -88.5) return 'Chicago';
  if (lat > 51 && lat < 52 && lng > -0.6 && lng < 0.4) return 'London';
  if (lat > 43.55 && lat < 43.9 && lng > -79.64 && lng < -79.12) return "Toronto";
  if (lat > 37 && lat < 38 && lng > 126 && lng < 128) return 'Seoul';
  return 'Other';
}

export default function App() {
  const [savedLocations, setSavedLocations] = useState([]);
  const [currentSearchResult, setCurrentSearchResult] = useState(null);
  // -1이면 검색 결과를 보고 있다는 의미
  const [activeLocationIndex, setActiveLocationIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState('single'); // 'single' | 'compare'
  const [selectedFacilityType, setSelectedFacilityType] = useState(null);

  // -----------------------------
  // 검색 핸들러
  // -----------------------------
  const handleSearch = async (location) => {
    setIsLoading(true);
    // 새로운 장소 검색하면 선택된 시설 타입 초기화
    setSelectedFacilityType(null);

    try {
      // 1) stay-score API 호출
      const res = await fetch(
        `${API_BASE_URL}/api/stay-score?address=${encodeURIComponent(location)}`
      );

      if (!res.ok) throw new Error('Stay Score API Error');

      const data = await res.json();

      const lat = data.query.lat;
      const lng = data.query.lng;

      // ✅ 1) 위/경도로 도시 판별
      const city = detectCityByLatLng(lat, lng);

      // ============================
      // 2) 편의성 (백엔드 결과 그대로 사용)
      // ============================
      const convenience = data.scores.convenience;

      const convenienceScore = convenience.score;
      const nearbyFacilities = [
        {
          name: '편의점',
          count: convenience.facilities.convenienceStore.count,
        },
        {
          name: '약국',
          count: convenience.facilities.pharmacy.count,
        },
        {
          name: '병원',
          count: convenience.facilities.hospital.count,
        },
        {
          name: '경찰서',
          count: convenience.facilities.police.count,
        },
      ];

      // ============================
      // 3) 대중교통 (지하철역)
      // ============================
      const transit = data.scores.transit;

      let nearestStation = transit.station
        ? {
            name: transit.station.name,
            distance: transit.station.distanceText,
            walkTime: transit.station.walkTimeText,
            lat: transit.station.lat,
            lng: transit.station.lng,
          }
        : null;

      // ============================
      // 4) 안전 점수
      //    (지금은 chicago만 실제 API, 나머지는 기본값)
      // ============================
      let safetyScore = 75;
      let safetyGrade = 'B';

      if (city !== 'Other') {
        try {
          // ✅ 나중에 seoul, la 추가하면 그대로 확장 가능
          const safetyRes = await fetch(
            `${API_BASE_URL}/api/safety/${city.toLowerCase()}/point?lat=${lat}&lng=${lng}`
          );
          if (safetyRes.ok) {
            const safetyData = await safetyRes.json();
            safetyScore = safetyData.score;
            safetyGrade = safetyData.grade;
          }
        } catch (e) {
          console.log('Safety fetch error:', e);
        }
      }

      // ============================
      // 5) 최종 UI 데이터 묶기
      // ============================
      const finalObj = {
        location,
        lat,
        lng,
        city,                 // ✅ 도시 정보 저장

        // Safety
        safetyScore,
        safetyGrade,

        // Convenience
        convenienceScore,
        nearbyFacilities,

        // Transit
        nearestStation,

        // MVP: 접근성은 일단 제외 (원하면 추가)
        accessibilityScore: data.scores.cityAccess.score,
        accessibilityTime: null,

        // ⭐ 접근성
        cityAccess: data.scores.cityAccess,
      };

      setCurrentSearchResult(finalObj);
      setActiveLocationIndex(-1);
      setViewMode('single');
    } catch (err) {
      console.error(err);
      alert('위치 분석 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 그래프 막대 눌렀을 때 호출
  const handleFacilitySelect = (type) => {
    setSelectedFacilityType(type);
  };

  const handleGoHome = () => {
    setSavedLocations([]);
    setCurrentSearchResult(null);
    setActiveLocationIndex(-1);
    setViewMode('single');
    setSelectedFacilityType(null);
  };

  const handleAddToSidebar = () => {
    if (currentSearchResult) {
      setSavedLocations((prev) => [...prev, currentSearchResult]);
    }
  };

  const handleCloseTab = (index) => {
    const newLocations = savedLocations.filter((_, i) => i !== index);
    setSavedLocations(newLocations);

    if (activeLocationIndex >= newLocations.length) {
      setActiveLocationIndex(Math.max(-1, newLocations.length - 1));
    }
    if (newLocations.length === 0) {
      setViewMode('single');
    }
    setSelectedFacilityType(null);
  };

  const handleTabClick = (index) => {
    setActiveLocationIndex(index);
    setViewMode('single');
    setSelectedFacilityType(null);
  };

  const displayLocation =
    activeLocationIndex >= 0
      ? savedLocations[activeLocationIndex]
      : currentSearchResult;

  const isAlreadyAdded =
    currentSearchResult &&
    savedLocations.some((loc) => loc.location === currentSearchResult.location);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {!currentSearchResult && savedLocations.length === 0 ? (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Hero onSearch={handleSearch} isLoading={isLoading} />
        </div>
      ) : (
        <div className="flex h-screen overflow-hidden">
          <LocationSidebar
            locations={savedLocations}
            activeIndex={activeLocationIndex}
            onTabClick={handleTabClick}
            onAddTab={handleAddToSidebar}
            onCloseTab={handleCloseTab}
          />

          <div className="flex-1 overflow-y-auto">
            <Header onLogoClick={handleGoHome} />

            <div className="max-w-7xl mx-auto px-8 py-8">
              <div className="mb-8 flex items-center gap-4">
                <div className="flex-1">
                  <SearchBar
                    onSearch={handleSearch}
                    isLoading={isLoading}
                    initialValue={displayLocation?.location || ''}
                  />
                </div>

                {activeLocationIndex === -1 &&
                  currentSearchResult &&
                  !isAlreadyAdded && (
                    <Button
                      onClick={handleAddToSidebar}
                      className="h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                      <List className="w-4 h-4 mr-2" />
                      이 장소 추가
                    </Button>
                  )}

                {activeLocationIndex === -1 && isAlreadyAdded && (
                  <div className="h-12 px-4 flex items-center bg-gray-100 rounded-lg text-gray-600">
                    ✓ 이미 추가됨
                  </div>
                )}

                {savedLocations.length > 1 && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setViewMode('single')}
                      variant={viewMode === 'single' ? 'default' : 'outline'}
                      className="h-12"
                    >
                      <List className="w-4 h-4 mr-2" />
                      상세보기
                    </Button>
                    <Button
                      onClick={() => setViewMode('compare')}
                      variant={viewMode === 'compare' ? 'default' : 'outline'}
                      className="h-12"
                    >
                      <LayoutGrid className="w-4 h-4 mr-2" />
                      비교하기
                    </Button>
                  </div>
                )}
              </div>

              {viewMode === 'compare' && savedLocations.length > 1 ? (
                <ComparisonView locations={savedLocations} />
              ) : displayLocation ? (
                <>
                  <div className="mb-6">
                    <h2 className="text-gray-900 mb-2">
                      {displayLocation.location}
                    </h2>
                    <p className="text-gray-600">
                      여행 안전 및 생활 편의 인텔리전스 분석 결과
                    </p>
                  </div>

                  <div className="mb-6">
                    <SafetyHeatMap
                      location={displayLocation.location}
                      city={displayLocation.city}          // ✅ 도시 전달
                      safetyScore={displayLocation.safetyScore}
                      lat={displayLocation.lat}
                      lng={displayLocation.lng}
                      selectedFacilityType={selectedFacilityType}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <SafetyScore
                      score={displayLocation.safetyScore}
                      grade={displayLocation.safetyGrade}
                    />
                    <AccessibilityScore
                      score={displayLocation.cityAccess?.score}
                      distanceKm={displayLocation.cityAccess?.distanceKm}
                      landmark={displayLocation.cityAccess?.landmark}
                    />

                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ConvenienceScore
                      score={displayLocation.convenienceScore}
                      facilities={displayLocation.nearbyFacilities}
                      onFacilitySelect={handleFacilitySelect}
                    />
                    <TransportInfo station={displayLocation.nearestStation} />
                  </div>
                </>
              ) : (
                <div className="text-center py-20">
                  <div className="text-gray-400 mb-4">🔍</div>
                  <h3 className="text-gray-900 mb-2">장소를 검색해주세요</h3>
                  <p className="text-gray-600">
                    위 검색창에 분석하고 싶은 장소를 입력하세요
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
