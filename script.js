document.addEventListener('DOMContentLoaded', () => {
    const phaserContainer = document.getElementById('phaser-container');
    const readerStatus = document.getElementById('readerStatus');
    const tagInfoDiv = document.getElementById('tagInfo');
    const clonerButton = document.getElementById('clonerButton');
    const clonerStatus = document.getElementById('clonerStatus');
    const editIdInput = document.getElementById('editId');
    const editKeteranganInput = document.getElementById('editKeterangan');
    const applyEditButton = document.getElementById('applyEdit');
    const editStatusDiv = document.getElementById('editStatus');
    const addCoinButton = document.getElementById('addCoinButton');
    const newCoinIdInput = document.getElementById('newCoinId');
    const newCoinKeteranganInput = document.getElementById('newCoinKeterangan');

    // LocalStorage keys
    const COINS_DB_KEY = 'nfc_coins_database';
    const CURRENT_COIN_KEY = 'current_nfc_coin';

    // Initialize or load coins database from localStorage
    let coinsDatabase = loadCoinsDatabase();
    let currentCoinData = loadCurrentCoin();
    let coinSprites = []; // Array to store all coin sprites
    let readerSprite;
    let clonerSprite;
    let gameInstance;
    let contextMenu;
    let currentContextCoin = null;

    // Load coins database from localStorage
    function loadCoinsDatabase() {
        const savedCoins = localStorage.getItem(COINS_DB_KEY);
        if (savedCoins) {
            return JSON.parse(savedCoins);
        } else {
            // Initialize with default coin if no database exists
            const defaultCoin = {
                id: 'NFC-001',
                keterangan: 'Koin Asli dengan Kunci Aman',
                isCloned: false,
                clonedFrom: null,
                hash: generateHash('NFC-001' + 'Koin Asli dengan Kunci Aman' + 'false')
            };

            const initialDatabase = {
                'NFC-001': defaultCoin
            };

            localStorage.setItem(COINS_DB_KEY, JSON.stringify(initialDatabase));
            return initialDatabase;
        }
    }

    // Load current coin from localStorage or use default
    function loadCurrentCoin() {
        const savedCoin = localStorage.getItem(CURRENT_COIN_KEY);
        if (savedCoin) {
            return JSON.parse(savedCoin);
        } else {
            // Use first coin in database if available, otherwise create default
            const coinIds = Object.keys(coinsDatabase);
            if (coinIds.length > 0) {
                return coinsDatabase[coinIds[0]];
            } else {
                const defaultCoin = {
                    id: 'NFC-001',
                    keterangan: 'Koin Asli dengan Kunci Aman',
                    isCloned: false,
                    clonedFrom: null,
                    hash: generateHash('NFC-001' + 'Koin Asli dengan Kunci Aman' + 'false')
                };
                return defaultCoin;
            }
        }
    }

    // Save coin to database and localStorage
    function saveCoin(coinData) {
        coinsDatabase[coinData.id] = coinData;
        localStorage.setItem(COINS_DB_KEY, JSON.stringify(coinsDatabase));
    }

    // Save current coin to localStorage
    function saveCurrentCoin(coinData) {
        currentCoinData = coinData;
        localStorage.setItem(CURRENT_COIN_KEY, JSON.stringify(coinData));
    }

    // Simple hash function for coin data
    function generateHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(16); // Convert to hex string
    }

    // Update hash for a coin
    function updateCoinHash(coinData) {
        const dataString = coinData.id + coinData.keterangan + coinData.isCloned;
        coinData.hash = generateHash(dataString);
        return coinData;
    }

    // Validate coin hash
    function validateCoinHash(coinData) {
        const dataString = coinData.id + coinData.keterangan + coinData.isCloned;
        const calculatedHash = generateHash(dataString);
        return calculatedHash === coinData.hash;
    }

    function updateTagInfoDisplay() {
        let hashValidation = '';

        if (currentCoinData.hash) {
            const isValid = validateCoinHash(currentCoinData);
            hashValidation = isValid ?
                '<span style="color: green;">(Hash Valid)</span>' :
                '<span style="color: red;">(Hash Tidak Valid)</span>';
        }

        tagInfoDiv.innerHTML = `
            <strong>ID:</strong> ${currentCoinData.id}<br>
            <strong>Keterangan:</strong> ${currentCoinData.keterangan}<br>
            <strong>Status:</strong> ${currentCoinData.isCloned ?
                '<span style="color: red;">TERKLONING</span>' :
                '<span style="color: green;">ASLI</span>'}<br>
            <strong>Hash:</strong> ${currentCoinData.hash} ${hashValidation}
        `;
    }

    // Definisi untuk menu kontekstual
    class ContextMenu extends Phaser.GameObjects.Container {
        constructor(scene, x, y, coin) {
            super(scene, x, y);
            scene.add.existing(this);

            // Background untuk menu
            this.bg = scene.add.rectangle(0, 0, 100, 70, 0xffffff, 0.9);
            this.bg.setStrokeStyle(1, 0x000000);
            this.add(this.bg);

            // Tombol untuk menu Edit
            this.editButton = scene.add.text(0, -15, 'Edit', { fill: '#000', fontSize: '14px' });
            this.editButton.setOrigin(0.5);
            this.editButton.setInteractive({ useHandCursor: true });
            this.add(this.editButton);

            // Tombol untuk menu Info
            this.infoButton = scene.add.text(0, 15, 'Info', { fill: '#000', fontSize: '14px' });
            this.infoButton.setOrigin(0.5);
            this.infoButton.setInteractive({ useHandCursor: true });
            this.add(this.infoButton);

            // Tambahkan event listeners untuk tombol-tombol
            this.editButton.on('pointerdown', () => {
                // Munculkan panel edit untuk koin ini
                this.editCoin(coin);
                this.destroy();
            });

            this.infoButton.on('pointerdown', () => {
                // Menampilkan info koin
                this.showInfo(coin);
                this.destroy();
            });

            // Menghilangkan menu jika klik di luar menu
            scene.input.on('pointerdown', (pointer) => {
                if (!this.getBounds().contains(pointer.x, pointer.y)) {
                    this.destroy();
                }
            }, this);
        }

        editCoin(coin) {
            // Mengambil data dari koin dan mengisi form edit
            currentCoinData = {
                id: coin.getData('id'),
                keterangan: coin.getData('keterangan'),
                isCloned: coin.getData('isCloned'),
                hash: coin.getData('hash'),
                clonedFrom: coin.getData('clonedFrom')
            };

            // Update edit fields
            editIdInput.value = currentCoinData.id;
            editKeteranganInput.value = currentCoinData.keterangan;

            // Menampilkan data di panel info
            updateTagInfoDisplay();

            // Highlight form edit
            document.querySelector('.data-editor').style.boxShadow = '0 0 10px rgba(0, 123, 255, 0.5)';
            setTimeout(() => {
                document.querySelector('.data-editor').style.boxShadow = '2px 2px 5px rgba(0, 0, 0, 0.1)';
            }, 1000);
        }

        showInfo(coin) {
            // Tampilkan info koin di panel tag info
            const coinData = {
                id: coin.getData('id'),
                keterangan: coin.getData('keterangan'),
                isCloned: coin.getData('isCloned'),
                hash: coin.getData('hash'),
                clonedFrom: coin.getData('clonedFrom')
            };

            // Simpan koin sementara dan update display
            currentCoinData = coinData;
            updateTagInfoDisplay();

            // Highlight panel info
            tagInfoDiv.style.boxShadow = '0 0 10px rgba(0, 123, 255, 0.5)';
            setTimeout(() => {
                tagInfoDiv.style.boxShadow = 'none';
            }, 1000);
        }
    }

    class MainScene extends Phaser.Scene {
        constructor() {
            super({ key: 'MainScene' });
            this.coinTexts = {}; // Store text objects associated with coins
        }

        preload() {
            // We'll create graphics for the coin instead of loading an image
        }

        create() {
            // Create different coin textures for original and cloned
            this.createCoinTextures();

            // Create reader and cloner textures
            this.createMachineTextures();

            // Create coin sprite based on current data
            this.createInitialCoins();

            // Create reader sprite - posisikan di sebelah kiri
            readerSprite = this.physics.add.staticSprite(200, 100, 'reader');
            readerSprite.setSize(120, 60);

            // Add text to reader
            this.add.text(readerSprite.x - 40, readerSprite.y - 10, "NFC Reader", {
                fontSize: '14px',
                fill: '#000'
            });

            // Create cloner sprite - posisikan di sebelah kanan
            clonerSprite = this.physics.add.staticSprite(360, 100, 'cloner');
            clonerSprite.setSize(120, 60);

            // Add text to cloner
            this.add.text(clonerSprite.x - 40, clonerSprite.y - 10, "NFC Cloner", {
                fontSize: '14px',
                fill: '#000'
            });

            // Event drag for coins
            this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
                gameObject.x = dragX;
                gameObject.y = dragY;

                // Move associated text with the coin
                if (this.coinTexts[gameObject.getData('id')]) {
                    this.coinTexts[gameObject.getData('id')].x = dragX;
                    this.coinTexts[gameObject.getData('id')].y = dragY + 30;
                }
            });

            // Event dragend for coins
            this.input.on('dragend', (pointer, gameObject) => {
                if (!this.physics.overlap(gameObject, readerSprite)) {
                    readerStatus.textContent = 'Siap Membaca';
                }

                if (this.physics.overlap(gameObject, clonerSprite)) {
                    this.cloneCoin(gameObject);
                }
            });

       // Event untuk klik kanan (menampilkan context menu)
       this.input.on('pointerdown', (pointer) => {
        // Jika klik kanan
        if (pointer.rightButtonDown()) {
            // Cek apakah klik pada koin
            let clickedCoin = null;
            coinSprites.forEach(coin => {
                if (coin && coin.getBounds().contains(pointer.x, pointer.y)) {
                    clickedCoin = coin;
                }
            });

            // Jika klik pada koin, munculkan context menu
            if (clickedCoin) {
                // Hapus menu sebelumnya jika ada
                if (contextMenu) {
                    contextMenu.destroy();
                }

                // Buat menu baru
                contextMenu = new ContextMenu(this, pointer.x, pointer.y, clickedCoin);
                currentContextCoin = clickedCoin;

                // Prevent default browser context menu
                this.input.mousePointer.rightButton.preventDefault = true; // Perubahan di sini!
            } else {
                // Re-enable context menu jika klik di luar koin
                this.input.mousePointer.rightButton.preventDefault = false; // Dan di sini!

                // Hapus menu sebelumnya jika ada
                if (contextMenu) {
                    contextMenu.destroy();
                }
            }
        }
    });
        }

        createCoinTextures() {
            // Create original coin texture (gold)
            const originalCoinGraphics = this.add.graphics();
            originalCoinGraphics.fillStyle(0xFFD700, 1); // Gold color
            originalCoinGraphics.fillCircle(50, 50, 50);
            originalCoinGraphics.fillStyle(0xDBA901, 1); // Darker gold for inner detail
            originalCoinGraphics.fillCircle(50, 50, 40);
            originalCoinGraphics.fillStyle(0xFFD700, 1);
            originalCoinGraphics.fillCircle(50, 50, 35);
            originalCoinGraphics.generateTexture('original-coin', 100, 100);
            originalCoinGraphics.clear();

            // Create cloned coin texture (silver)
            const clonedCoinGraphics = this.add.graphics();
            clonedCoinGraphics.fillStyle(0xC0C0C0, 1); // Silver color
            clonedCoinGraphics.fillCircle(50, 50, 50);
            clonedCoinGraphics.fillStyle(0x909090, 1); // Darker silver for inner detail
            clonedCoinGraphics.fillCircle(50, 50, 40);
            clonedCoinGraphics.fillStyle(0xC0C0C0, 1);
            clonedCoinGraphics.fillCircle(50, 50, 35);
            clonedCoinGraphics.generateTexture('cloned-coin', 100, 100);
            clonedCoinGraphics.clear();
        }

        createMachineTextures() {
            // Create reader texture (green)
            const readerGraphics = this.add.graphics();
            readerGraphics.fillStyle(0x00ff00, 1);
            readerGraphics.fillRect(0, 0, 120, 60);
            readerGraphics.generateTexture('reader', 120, 60);
            readerGraphics.clear();

            // Create cloner texture (blue)
            const clonerGraphics = this.add.graphics();
            clonerGraphics.fillStyle(0x0088ff, 1);
            clonerGraphics.fillRect(0, 0, 120, 60);
            clonerGraphics.generateTexture('cloner', 120, 60);
            clonerGraphics.clear();
        }

        createInitialCoins() {
            // Clear existing coin sprites and texts
            coinSprites.forEach(coin => {
                if (coin) coin.destroy();
            });
            coinSprites = [];

            Object.values(this.coinTexts).forEach(text => {
                if (text) text.destroy();
            });
            this.coinTexts = {};

            // Create a coin for each entry in the database
            let xPos = 50;

            Object.values(coinsDatabase).forEach((coinData, index) => {
                // Skip if we already have too many coins on screen
                if (index >= 3) return;

                const coinSprite = this.createCoinSprite(xPos, 100, coinData);
                coinSprites.push(coinSprite);

                // Update xPos for next coin
                xPos += 70;
            });

            // If no coins were created, create a default one
            if (coinSprites.length === 0) {
                const coinSprite = this.createCoinSprite(100, 100, currentCoinData);
                coinSprites.push(coinSprite);
            }
        }

        update() {
            // Check overlap between any coin and reader
            let foundOverlap = false;

            coinSprites.forEach(coinSprite => {
                if (coinSprite && readerSprite && this.physics.overlap(coinSprite, readerSprite)) {
                    foundOverlap = true;
                    readerStatus.textContent = 'Koin Terdeteksi!';

                    // Get data from sprite
                    currentCoinData.id = coinSprite.getData('id');
                    currentCoinData.keterangan = coinSprite.getData('keterangan');
                    currentCoinData.isCloned = coinSprite.getData('isCloned');
                    currentCoinData.hash = coinSprite.getData('hash');
                    currentCoinData.clonedFrom = coinSprite.getData('clonedFrom');
                      // Save current coin
                saveCurrentCoin(currentCoinData);

                // Update display
                updateTagInfoDisplay();

                // Update edit fields
                editIdInput.value = currentCoinData.id;
                editKeteranganInput.value = currentCoinData.keterangan;
            }
        });

        if (!foundOverlap && readerStatus.textContent === 'Koin Terdeteksi!') {
            readerStatus.textContent = 'Siap Membaca';
        }
    }

    createCoinSprite(x, y, data) {
        const texture = data.isCloned ? 'cloned-coin' : 'original-coin';
        const coin = this.physics.add.sprite(x, y, texture);
        coin.setScale(0.5);
        coin.setInteractive();
        coin.setCollideWorldBounds(true);

        // Store data in sprite
        coin.setData('id', data.id);
        coin.setData('keterangan', data.keterangan);
        coin.setData('isCloned', data.isCloned);
        coin.setData('hash', data.hash);
        coin.setData('clonedFrom', data.clonedFrom);

        this.input.setDraggable(coin);

        // Add text label below coin
        const statusText = data.isCloned ? 'CLONE' : 'ASLI';
        const textStyle = {
            fontSize: '10px',
            fontWeight: 'bold',
            fill: data.isCloned ? '#FF0000' : '#008000',
            backgroundColor: '#FFFFFF',
            padding: { x: 2, y: 1 }
        };

        const coinText = this.add.text(x, y + 30, `${data.id}\n${statusText}`, textStyle);
        coinText.setOrigin(0.5, 0.5);
        this.coinTexts[data.id] = coinText;

        return coin;
    }

    // Add a new coin to the scene
    addNewCoin(coinData) {
        // Find an empty spot for the new coin
        let xPos = 50;
        const usedPositions = coinSprites.map(coin => coin.x);

        while (usedPositions.includes(xPos)) {
            xPos += 70;
        }

        // Create the new coin sprite
        const newCoin = this.createCoinSprite(xPos, 100, coinData);
        coinSprites.push(newCoin);

        return newCoin;
    }

    // Clone coin functionality when dropped on cloner
    cloneCoin(coinToClone) {
        // Get the data from the coin
        const coinData = {
            id: coinToClone.getData('id'),
            keterangan: coinToClone.getData('keterangan'),
            isCloned: coinToClone.getData('isCloned'),
            hash: coinToClone.getData('hash'),
            clonedFrom: coinToClone.getData('clonedFrom')
        };

        // Check if the coin is valid before cloning
        const isValid = validateCoinHash(coinData);

        if (!isValid) {
            clonerStatus.textContent = 'Koin Tidak Valid! Tidak Dapat Menambahkan';
            return;
        }

        // Create cloned coin data
        const clonedCoinId = `CLONE-${coinData.id}-${Date.now().toString().substr(-4)}`;
        const clonedCoinData = {
            id: clonedCoinId,
            keterangan: `Kloningan dari ${coinData.id}`,
            isCloned: true,
            clonedFrom: coinData.id,
            hash: null // Will be generated below
        };

        // Generate hash for cloned coin
        updateCoinHash(clonedCoinData);

        // Save to database
        saveCoin(clonedCoinData);

        // Create hanya satu koin kloning di posisi depan NFC cloner
        const clonedCoin = this.createCoinSprite(clonerSprite.x - 70, clonerSprite.y, clonedCoinData);
        coinSprites.push(clonedCoin);

        // Set current coin to the cloned one
        currentCoinData = clonedCoinData;
        saveCurrentCoin(currentCoinData);

        // Update display
        updateTagInfoDisplay();
        clonerStatus.textContent = 'Koin Berhasil Ditambahkan!';

        // Reset status setelah beberapa detik
        setTimeout(() => {
            clonerStatus.textContent = 'Siap Menambahkan';
        }, 2000);
    }
}

const config = {
    type: Phaser.AUTO,
    width: 480, // Perlebar area game untuk muat dua mesin
    height: 200,
    parent: 'phaser-container',
    physics: {
        default: 'arcade'
    },
    scene: [MainScene]
};

gameInstance = new Phaser.Game(config);

// Functionality for applying edits to the coin data
applyEditButton.addEventListener('click', () => {
    // Find the coin sprite that matches the current coin
    const coinSprite = coinSprites.find(coin => coin && coin.getData('id') === currentCoinData.id);
    if (!coinSprite) return;

    // Update current coin data
    currentCoinData.id = editIdInput.value;
    currentCoinData.keterangan = editKeteranganInput.value;

    // Update hash
    updateCoinHash(currentCoinData);

    // Update sprite data
    coinSprite.setData('id', currentCoinData.id);
    coinSprite.setData('keterangan', currentCoinData.keterangan);
    coinSprite.setData('hash', currentCoinData.hash);

    // Save to database
    saveCoin(currentCoinData);
    saveCurrentCoin(currentCoinData);

    // Update text label
    const scene = gameInstance.scene.scenes[0];
    if (scene.coinTexts[coinSprite.getData('id')]) {
        scene.coinTexts[coinSprite.getData('id')].destroy();
    }

    const statusText = currentCoinData.isCloned ? 'CLONE' : 'ASLI';
    const textStyle = {
        fontSize: '10px',
        fontWeight: 'bold',
        fill: currentCoinData.isCloned ? '#FF0000' : '#008000',
        backgroundColor: '#FFFFFF',
        padding: { x: 2, y: 1 }
    };

    const coinText = scene.add.text(coinSprite.x, coinSprite.y + 30, `${currentCoinData.id}\n${statusText}`, textStyle);
    coinText.setOrigin(0.5, 0.5);
    scene.coinTexts[currentCoinData.id] = coinText;

    // Update display
    updateTagInfoDisplay();
    editStatusDiv.textContent = 'Data Koin Diperbarui';
    setTimeout(() => {
        editStatusDiv.textContent = '';
    }, 2000);
});

// Add new coin functionality
addCoinButton.addEventListener('click', () => {
    const scene = gameInstance.scene.scenes[0];

    // Get new coin data from inputs
    const newId = newCoinIdInput.value.trim();
    const newKeterangan = newCoinKeteranganInput.value.trim();

    // Validate
    if (!newId || !newKeterangan) {
        alert('ID dan Keterangan harus diisi!');
        return;
    }

    // Check if ID already exists
    if (coinsDatabase[newId]) {
        alert('ID Koin sudah ada! Gunakan ID yang berbeda.');
        return;
    }

    // Create new coin data
    const newCoinData = {
        id: newId,
        keterangan: newKeterangan,
        isCloned: false,
        clonedFrom: null,
        hash: null
    };

    // Generate hash
    updateCoinHash(newCoinData);

    // Save to database
    saveCoin(newCoinData);

    // Add to scene
    const newCoinSprite = scene.addNewCoin(newCoinData);

    // Set as current coin
    currentCoinData = newCoinData;
    saveCurrentCoin(currentCoinData);

    // Update edit fields
    editIdInput.value = currentCoinData.id;
    editKeteranganInput.value = currentCoinData.keterangan;

    // Clear add coin inputs
    newCoinIdInput.value = '';
    newCoinKeteranganInput.value = '';

    // Update display
    document.getElementById('addCoinStatus').textContent = 'Koin Baru Berhasil Ditambahkan!';
    setTimeout(() => {
        document.getElementById('addCoinStatus').textContent = '';
    }, 2000);
});

// Initialize panel status
clonerStatus.textContent = 'Siap Menambahkan';

// Initialize edit view with initial data
editIdInput.value = currentCoinData.id;
editKeteranganInput.value = currentCoinData.keterangan;
updateTagInfoDisplay();
});