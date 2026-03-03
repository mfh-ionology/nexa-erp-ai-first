# Healthcare (PCN/GP) Vertical Scenario

## Tenant
- **Code**: `DEMO_HEALTHCARE`
- **Name**: Nexa Primary Care Network
- **Vertical**: Healthcare / PCN
- **Roles**: ADMIN (`admin@healthcare.nexa.demo`), STAFF (`staff@healthcare.nexa.demo`)

## Scenario: Patient Registration → Appointment → Consultation → Billing → Reporting

### Step 1: Register Patient (STAFF)
**Module**: Healthcare / Patient Management
**Role**: STAFF
**Actions**:
1. Navigate to Healthcare → Patients
2. Register new patient:
   - Name: "John Smith"
   - DOB: 01/01/1980
   - NHS Number: "123 456 7890"
   - Address: "123 High Street, London, SW1A 1AA"
   - Practice: "Baker Street Practice" (PRAC-001)
3. Save patient record
4. Post message in #patients channel: "New patient registered: John Smith (NHS: 123 456 7890)"

**Expected State**:
- Patient record created
- Patient assigned to practice PRAC-001
- Patient number assigned (e.g., PAT-001)
- Patient appears in practice patient list

### Step 2: Schedule Appointment (STAFF)
**Module**: Healthcare / Appointments
**Role**: STAFF
**Actions**:
1. Navigate to Healthcare → Appointments
2. Create appointment for patient PAT-001
3. Select clinician: "Dr. Watson" (from Baker Street Practice)
4. Appointment type: "General Consultation"
5. Date/Time: Tomorrow, 10:00 AM
6. Duration: 15 minutes
7. Save appointment
8. Post message in #appointments channel: "Appointment scheduled: John Smith with Dr. Watson, tomorrow 10:00 AM"

**Expected State**:
- Appointment created
- Appointment appears in clinician's rota
- Appointment status: "Scheduled"
- Rota updated for Dr. Watson

### Step 3: Conduct Consultation (ADMIN/Clinician)
**Module**: Healthcare / Consultations
**Role**: ADMIN (acting as clinician)
**Actions**:
1. Navigate to Healthcare → Consultations
2. Open appointment from Step 2
3. Start consultation
4. Record consultation notes:
   - Chief complaint: "Chest pain"
   - Examination: "Normal heart sounds, no abnormalities"
   - Diagnosis: "Musculoskeletal pain"
   - Treatment: "Prescribed pain relief, follow-up in 2 weeks"
5. Complete consultation
6. Post message in #clinical channel: "Consultation completed for John Smith - musculoskeletal pain, prescribed pain relief"

**Expected State**:
- Consultation notes recorded
- Appointment status: "Completed"
- Consultation linked to patient record
- Treatment plan recorded

### Step 4: Process Billing (ADMIN)
**Module**: Healthcare / Billing
**Role**: ADMIN
**Actions**:
1. Navigate to Healthcare → Billing
2. Create invoice for consultation (PAT-001)
3. Service: "General Consultation" - £50.00
4. Payment method: "NHS" (if applicable) or "Self-pay"
5. Post invoice
6. Post message in #finance channel: "Invoice [INV-ID] created for John Smith consultation - £50.00"

**Expected State**:
- Invoice created
- Invoice number assigned (e.g., INV-HC-001)
- Invoice linked to patient and consultation
- Invoice status: "Posted"

### Step 5: Record Payment (ADMIN)
**Module**: Healthcare / Payments
**Role**: ADMIN
**Actions**:
1. Navigate to Healthcare → Payments
2. Record payment for invoice INV-HC-001
3. Payment method: "NHS" or "Card"
4. Amount: £50.00
5. Allocate payment to invoice
6. Post message in #finance channel: "Payment received for invoice [INV-ID]"

**Expected State**:
- Payment recorded
- Invoice status: "Paid"
- Payment allocated to invoice
- Practice revenue updated

### Step 6: Generate Reports and AI Queries (ADMIN)
**Module**: Healthcare / Reporting
**Role**: ADMIN
**Actions**:
1. Navigate to Healthcare → Reports → Rota Coverage
2. Review clinician rota for next week
3. Navigate to Healthcare → Reports → Patient Activity
4. Review patient registrations and consultations
5. Use AI bar to query: "What is the rota coverage for next week?"
6. Use AI bar to query: "How many consultations were completed today?"
7. Navigate to Finance → Reports → Practice Revenue
8. Verify consultation revenue appears

**Expected State**:
- Rota coverage report shows clinician availability
- Patient activity report shows registrations and consultations
- AI responses reflect healthcare data
- Practice revenue report shows consultation income
- No cross-tenant data visible

## Chat Integration Points
- **#patients**: Patient registration
- **#appointments**: Appointment scheduling
- **#clinical**: Consultation notes and outcomes
- **#finance**: Billing and payments

## Calls Integration Points
- **#clinical**: Audio call between clinicians to discuss patient case
- **#appointments**: Audio call to reschedule appointment

## AI Integration Points
- After Step 2: "What is the rota coverage for next week?"
- After Step 3: "How many consultations were completed today?"
- After Step 6: "Summarise patient activity in #patients"

## Expected End State
- Patient registered and appointment scheduled
- Consultation conducted and notes recorded
- Invoice created and payment received
- All transactions reflected in healthcare reports
- Chat messages posted in relevant channels
- AI queries return accurate tenant-scoped data

