const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieSession = require('cookie-session');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const base64url = require('base64url');
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const inMemoryUserDeviceDB = {};
const inMemoryCredentialDB = {};

const rpName = 'Perkins SSO';
const rpID = 'localhost';
const origin = 'http://localhost:8000';

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.use(
    cookieSession({
        name: 'session',
        keys: [crypto.randomBytes(32).toString('hex')],

        // Cookie Options
        maxAge: 0.5 * 60 * 60 * 1000, // 30 minutes
    })
);
app.use(cookieParser());

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '/index.html'));
});

app.get('/generate-registration-options', function (req, res) {
    let input_username = req.query.user_name;
    const id = crypto.randomUUID();
    console.log(id);

    inMemoryUserDeviceDB[id] = {
        id,
        username: `${input_username}@${rpID}`,
        devices: [],
        currentChallenge: undefined,
    };

    user = inMemoryUserDeviceDB[id];

    const { username, devices } = user;

    const options = generateRegistrationOptions({
        rpName,
        rpID,
        userID: id,
        userName: username,
        timeout: 60000,
        attestationType: 'none',
        excludeCredentials: devices.map((dev) => ({
            id: dev.credentialID,
            type: 'public-key',
            transports: dev.transports,
        })),
        authenticatorSelection: {
            userVerification: 'preferred',
            residentKey: 'required',
        },
        supportedAlgorithmIDs: [-7, -257],
    });

    inMemoryUserDeviceDB[id].currentChallenge = options.challenge;
    req.session.id = id;

    res.send(options);
});

app.post('/verify-registration', async function (req, res) {
    const { body } = req;

    const id = req.session.id;

    const user = inMemoryUserDeviceDB[id];
    const expectedChallenge = user.currentChallenge;

    let verification;
    try {
        const opts = {
            credential: body,
            expectedChallenge: `${expectedChallenge}`,
            expectedOrigin: 'http://localhost:8000',
            expectedRPID: rpID,
        };
        verification = await verifyRegistrationResponse(opts);
    } catch (error) {
        const _error = error;
        console.error(_error);
        return res.status(400).send({ error: _error.message });
    }

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
        const { credentialPublicKey, credentialID, counter } = registrationInfo;

        const existingDevice = user.devices.find((device) =>
            device.credentialID.equals(credentialID)
        );

        if (!existingDevice) {
            const newDevice = {
                credentialPublicKey,
                credentialID,
                counter,
                transports: body.transports,
            };
            user.devices.push(newDevice);
            inMemoryCredentialDB[credentialID.toString('ascii')] = user.id;
        }
    }

    res.send({ verified });
});

app.get('/generate-authentication-options', (req, res) => {
    const opts = {
        timeout: 60000,
        userVerification: 'preferred',
        rpID,
    };

    const options = generateAuthenticationOptions(opts);

    req.session.challenge = options.challenge;

    res.send(options);
});

app.post('/verify-authentication', (req, res) => {
    const body = req.body;

    const expectedChallenge = req.session.challenge;

    let dbAuthenticator;
    const bodyCredIDBuffer = base64url.toBuffer(body.rawId);
    // "Query the DB" here for an authenticator matching `credentialID`
    user_id = inMemoryCredentialDB[bodyCredIDBuffer.toString('ascii')];

    if (!user_id) {
        return res
            .status(400)
            .send({ error: 'Authenticator is not registered with this site' });
    }

    dbAuthenticator = inMemoryUserDeviceDB[user_id].devices.find((dev) =>
        dev.credentialID.equals(bodyCredIDBuffer)
    );

    let verification;
    try {
        const opts = {
            credential: body,
            expectedChallenge: `${expectedChallenge}`,
            expectedOrigin: 'http://localhost:8000',
            expectedRPID: rpID,
            authenticator: dbAuthenticator,
        };
        verification = verifyAuthenticationResponse(opts);
    } catch (error) {
        const _error = error;
        console.error(_error);
        return res.status(400).send({ error: _error.message });
    }

    const { verified, authenticationInfo } = verification;

    let returnData = { verified };

    if (verified) {
        dbAuthenticator.counter = authenticationInfo.newCounter;
        returnData.username = inMemoryUserDeviceDB[user_id].username;
    }

    res.send(returnData);
});

app.listen(8000);
