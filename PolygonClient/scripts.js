let drawings = []; // name,number,coord'dan olusan modelin listesi. Apiden dolduracagiz..
let apiUrl="https://localhost:7244/api/Drawings"; // istek atilacak servis url'im

//dom yuklendiginde..
document.addEventListener('DOMContentLoaded', () => {
    //animasyon icin ilk view.
    const initialView = new ol.View({
        center: ol.proj.fromLonLat([35, 39]), //TC merkezde
        zoom: 2 
    });

    const map = createMap(initialView); // mapi ilk view ile olustur.
    const vectorSource = new ol.source.Vector({ wrapX: false });
    const vectorLayer = new ol.layer.Vector({ source: vectorSource });
    map.addLayer(vectorLayer);

    //animation ekle ve calısıtır.
    map.once('postrender', () => {
        initialView.animate({
            zoom: 6, 
            duration: 2000, 
            center: ol.proj.fromLonLat([35, 39])
        });
    });


    // add drawing butona tıklanınca cizim modunu ac. hangi map'e cizecegiz, vector bilgileri ne ? parametre gönder..
    document.getElementById('addDrawing').addEventListener('click', () => {
        //zaten cizim modundaysa butonu disable et..
        document.getElementById('addDrawing').disabled = true;

        startDrawingInteraction(map, vectorSource);
    });

    //qurey pop up'ını ac..
    document.getElementById('queryDrawing').addEventListener('click', () => {
        //zaten sorgu menusu aciksa butonu disable et..
        document.getElementById('queryDrawing').disabled = true;

        showQueryPopup(drawings);
    });

    //dom content yüklendikten hemen sonra benim drawings listemi api'den gelen veriyle doldur..
    getDrawings().then(data => {
        drawings = data;
        drawToMapDrawings(vectorSource, drawings); //getirdigin verileri haritaya bas
    });

});

//OL map olustur.(OSM)
function createMap(initialView) {
    return new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            })
        ],
        view: initialView
    });
}

//api'ye get istegi atan metot.
async function getDrawings() {
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}

//drawing'teki coord. verilerini map'e cizen metot.
function drawToMapDrawings(vectorSource, drawings) {
    vectorSource.clear();
    drawings.forEach(data => {
        const feature = new ol.Feature({
            geometry: new ol.geom.Polygon([data.coordinates])
        });
        vectorSource.addFeature(feature);
    });
}


//cizim islemi basladıgında
function startDrawingInteraction(map, vectorSource) {

    let draw; 

    if (draw) {
        map.removeInteraction(draw);
    }
    
    draw = new ol.interaction.Draw({
        source: vectorSource,
        type: 'Polygon'
    });

    map.addInteraction(draw);

    //cizim bitince koordinatları al ve showdrawinge gönder (js_panel acan metod'a gönder.)
    draw.on('drawend', (event) => {
        const coords = event.feature.getGeometry().getCoordinates()[0];
        showDrawingPopup(map, vectorSource, coords); //bitince pop up'ı ac.
    });

    //cizim islemi iptali
    document.addEventListener('keydown', function escKeyListener(e) {
        if (e.key === 'Escape') {
            map.removeInteraction(draw);
            document.removeEventListener('keydown', escKeyListener); // Dinleyiciyi kaldır
            document.getElementById('addDrawing').disabled = false;

        }
    });
    
    
}

//cizim bitince js_panel acan metod. polygonun kapandigi anda calisir.
function showDrawingPopup(map, vectorSource, coordinates) {
    
    // Geçici çizim özelliği değişkeni
    let temporaryFeature;

    // jsPanel kullanarak bir popup oluştur
    const panel = $.jsPanel({
        contentSize: '400 200',
        headerTitle: 'Add Drawing',
        content: `
        <form id="drawingForm">
            <div>
                <label for="name">Name:</label><br>
                <input type="text" id="name" name="name" required>
            </div>
            <div>
                <label for="number">Number:</label><br>
                <input type="number" id="number" name="number" required>
            </div>
                <button type="submit">Save</button>
        </form>

        `,
        callback: function (panel) {
            document.getElementById('drawingForm').onsubmit = async (e) => {
                e.preventDefault();
                let name = document.getElementById('name').value;
                let number = document.getElementById('number').value;
                number = parseInt(number, 10);
        
                if (isNaN(number)) {
                    alert('Please enter a valid integer for the number.');
                    return;
                }
        
                let drawing = {
                    Name: name,
                    Number: number,
                    Coordinates: coordinates
                };
                // Formdan alınan verileri API'ye gönder
                await saveDrawing(drawing, vectorSource); //formu kaydedince modeli api'ye atarız (post icin)
                panel.close();
            };
        },
        
        onclosed: async function() {
            // Eğer form kapatılırsa ve submit edilmezse geçici çizimi kaldır. (Panel acildi ama veri eklenemden carpiya basildi case'i icin.)
            if (temporaryFeature) {
                vectorSource.removeFeature(temporaryFeature);
               // console.log("Geçici çizim kaldırıldı");
            }
            // apideki çizimleri yükle ve haritaya ekle
            let drawings = await getDrawings();
            drawToMapDrawings(vectorSource, drawings);
        }
    });

}


// api'ye veri gönderdigim metot, (post islemi..)
async function saveDrawing(drawing,vectorSource) {
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(drawing)
        
        });
       // debugger;
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        const savedDrawing = await response;
        alert('Drawing saved successfully.');

        // son verileri al ve güncelle, map'e bas...
        drawings = await getDrawings();
        drawToMapDrawings(vectorSource, drawings);
    } catch (error) {
        alert('Error saving drawing.',error);
    }
}

//dolduruluan JSON veriyi map'le tabloya bas.
function showQueryPopup(drawings) {
    //debugger;
    let tableHtml = `
        <table id="drawingsTable">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Number</th>
                    <th>Coordinates</th>
                </tr>
            </thead>
            <tbody>
                ${drawings.map(d => `
                    <tr>
                        <td>${d.name}</td>
                        <td>${d.number}</td>
                        <td>${JSON.stringify(d.coordinates)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    //paneli create et ajax ile  contenti doldur. pagination yap scrolloble olsun.                
    const panel = $.jsPanel({
        contentSize: '600 400',
        headerTitle: 'Query Drawings',
        content: tableHtml,
        callback: function () {
            $('#drawingsTable').DataTable({
                scrollY: '300px',
                scrollCollapse: true,
                paging: true
            });
        },
        onclosed: function () {
            // Form kapatıldığında butonu tekrar etkinleştir
            document.getElementById('queryDrawing').disabled = false;
        }
    });
}
