const map = L.map("map").setView([36.6285, 127.4588], 16);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let allRoutesLayer;
let allData = [];

function getRouteColor(recommendation) {
  return recommendation === "추천" ? "#2e9d63" : "#d94b4b";
}

function routeStyle(feature) {
  const recommendation = feature.properties["추천여부"];
  return {
    color: getRouteColor(recommendation),
    weight: 6,
    opacity: 0.9
  };
}

function createPopupContent(props) {
  return `
    <div style="font-size:14px; line-height:1.6;">
      <strong>${props["이름"] || "이름 없음"}</strong><br>
      표면 상태: ${props["표면"] || "정보 없음"}<br>
      추천 여부: ${props["추천여부"] || "정보 없음"}
    </div>
  `;
}

function renderRouteList(data) {
  const routeList = document.getElementById("routeList");
  routeList.innerHTML = "";

  data.forEach(feature => {
    const props = feature.properties;
    const recommended = props["추천여부"] === "추천";
    const badgeClass = recommended ? "green" : "red";

    const card = document.createElement("div");
    card.className = "route-card";
    card.innerHTML = `
      <h3>${props["이름"] || "이름 없음"}</h3>
      <div class="badge ${badgeClass}">${props["추천여부"] || "정보 없음"}</div>
      <p><strong>표면 상태:</strong> ${props["표면"] || "정보 없음"}</p>
    `;

    routeList.appendChild(card);
  });
}

function loadAllRoutes() {
  fetch("routes.geojson")
    .then(response => response.json())
    .then(data => {
      allData = data.features;

      allRoutesLayer = L.geoJSON(data, {
        style: routeStyle,
        onEachFeature: function (feature, layer) {
          layer.bindPopup(createPopupContent(feature.properties));
        }
      }).addTo(map);

      map.fitBounds(allRoutesLayer.getBounds(), { padding: [30, 30] });
      renderRouteList(allData);
    })
    .catch(error => {
      console.error("GeoJSON 불러오기 실패:", error);
      alert("routes.geojson 파일을 불러오지 못했어.");
    });
}

function showRecommendedRoutesOnly() {
  if (allRoutesLayer) {
    map.removeLayer(allRoutesLayer);
  }

  const recommendedFeatures = allData.filter(
    feature => feature.properties["추천여부"] === "추천"
  );

  allRoutesLayer = L.geoJSON(
    {
      type: "FeatureCollection",
      features: recommendedFeatures
    },
    {
      style: routeStyle,
      onEachFeature: function (feature, layer) {
        layer.bindPopup(createPopupContent(feature.properties));
      }
    }
  ).addTo(map);

  if (recommendedFeatures.length > 0) {
    map.fitBounds(allRoutesLayer.getBounds(), { padding: [30, 30] });
  }

  renderRouteList(recommendedFeatures);
}

function showAllRoutes() {
  if (allRoutesLayer) {
    map.removeLayer(allRoutesLayer);
  }

  allRoutesLayer = L.geoJSON(
    {
      type: "FeatureCollection",
      features: allData
    },
    {
      style: routeStyle,
      onEachFeature: function (feature, layer) {
        layer.bindPopup(createPopupContent(feature.properties));
      }
    }
  ).addTo(map);

  if (allData.length > 0) {
    map.fitBounds(allRoutesLayer.getBounds(), { padding: [30, 30] });
  }

  renderRouteList(allData);
}

document.getElementById("showRecommended").addEventListener("click", showRecommendedRoutesOnly);
document.getElementById("showAll").addEventListener("click", showAllRoutes);

loadAllRoutes();
