UPDATE "School"
SET "name" = 'Colaninfo Tech',
    "latitude" = 13.067930644538661,
    "longitude" = 80.25592817406542,
    "address" = 'Colaninfo Tech',
    "active" = true,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'school-001';

UPDATE "School"
SET "active" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE ("id" = 'school-002' AND "name" = 'Harbour View High School')
   OR ("id" = 'school-003' AND "name" = 'Marina Matriculation');
