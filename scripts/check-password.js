const bcrypt = require('bcryptjs');

const hash = '$2b$10$Q13LoOe6GuSrto9fBIt4RutN/Ww8rLbNeddycHmA1pOh5L58wkV1y';
const passwords = ['admin123', 'atsoko123', 'Test1234!', 'password123', '12345678', 'Atsoko2024!', 'admin', 'test123', 'Atsoko123!', 'atsoko12345'];

async function tryAll() {
    for (const pw of passwords) {
        const match = await bcrypt.compare(pw, hash);
        if (match) {
            console.log('FOUND PASSWORD:', pw);
            process.exit(0);
        }
    }
    console.log('None matched');
}
tryAll();
