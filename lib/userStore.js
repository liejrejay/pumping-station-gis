/**
 * 用戶資料儲存：有 MONGODB_URI 時寫入 Atlas（部署不會清空），否則用本機檔案。
 */
const fs = require('fs').promises;
const path = require('path');

const USERS_FILE =
    process.env.USERS_FILE ||
    path.join(process.env.USERS_DATA_DIR || path.join(__dirname, '..', 'data'), 'users.json');

const MONGO_DOC_ID = 'main';

let storageMode = 'file';
let mongoCollection = null;
let mongoClient = null;

function defaultUsersData(systemUsers) {
    return {
        systemUsers,
        registeredUsers: {},
        metadata: {
            totalUsers: Object.keys(systemUsers).length,
            totalRegistered: 0,
            lastUpdated: new Date().toISOString(),
            version: '1.0',
        },
    };
}

async function readUsersFromFile(systemUsers) {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (_) {
        const seed = defaultUsersData(systemUsers);
        await writeUsersToFile(seed);
        return seed;
    }
}

async function writeUsersToFile(data) {
    await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
    await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function initUserStore(systemUsers) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        storageMode = 'file';
        console.log(`[userStore] 檔案模式：${USERS_FILE}（Render 免費版重新部署會還原 repo 內容）`);
        return storageMode;
    }

    try {
        const { MongoClient } = require('mongodb');
        mongoClient = new MongoClient(uri);
        await mongoClient.connect();
        const db = mongoClient.db(process.env.MONGODB_DB || 'pumping_station_gis');
        mongoCollection = db.collection('users_data');

        const existing = await mongoCollection.findOne({ _id: MONGO_DOC_ID });
        if (!existing) {
            const seed = await readUsersFromFile(systemUsers);
            await mongoCollection.replaceOne(
                { _id: MONGO_DOC_ID },
                { _id: MONGO_DOC_ID, ...seed },
                { upsert: true }
            );
            console.log('[userStore] MongoDB 已建立初始用戶資料');
        }

        storageMode = 'mongo';
        console.log('[userStore] MongoDB 模式（部署後資料保留）');
        return storageMode;
    } catch (err) {
        console.error('[userStore] MongoDB 連線失敗，改回檔案模式:', err.message);
        storageMode = 'file';
        mongoCollection = null;
        if (mongoClient) {
            try {
                await mongoClient.close();
            } catch (_) { /* ignore */ }
            mongoClient = null;
        }
        return storageMode;
    }
}

async function readUsers(systemUsers) {
    if (storageMode === 'mongo' && mongoCollection) {
        const doc = await mongoCollection.findOne({ _id: MONGO_DOC_ID });
        if (doc) {
            const { _id, ...data } = doc;
            return data;
        }
    }
    return readUsersFromFile(systemUsers);
}

async function writeUsers(data, systemUsers) {
    if (storageMode === 'mongo' && mongoCollection) {
        await mongoCollection.replaceOne(
            { _id: MONGO_DOC_ID },
            { _id: MONGO_DOC_ID, ...data },
            { upsert: true }
        );
        console.log('✅ 用戶資料已寫入 MongoDB:', new Date().toLocaleString());
        return true;
    }
    await writeUsersToFile(data);
    console.log('✅ 用戶資料已寫入檔案:', new Date().toLocaleString());
    return true;
}

function getStorageMode() {
    return storageMode;
}

function isPersistentStorage() {
    return storageMode === 'mongo';
}

module.exports = {
    initUserStore,
    readUsers,
    writeUsers,
    getStorageMode,
    isPersistentStorage,
    USERS_FILE,
};
