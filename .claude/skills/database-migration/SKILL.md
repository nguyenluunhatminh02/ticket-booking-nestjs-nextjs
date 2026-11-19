---
name: database-migration
description: Schema migrations, data migrations, rollback strategies, migration versioning, zero-downtime migrations, backward compatibility, migration testing, and database evolution patterns. Use when modifying database schemas, migrating data between formats, implementing version control for databases, or planning database changes with minimal downtime.
license: MIT
version: 1.0.0
trigger: When modifying database schemas, migrating data between formats, implementing version control for databases, or planning database changes with minimal downtime.
---

# Database Migration Skill

Evolve database schemas safely with version-controlled migrations, zero-downtime strategies, and robust rollback plans.

## When to Use

- Modifying database schemas
- Migrating data between formats
- Adding/removing columns or tables
- Changing data types or constraints
- Implementing version control for databases
- Planning zero-downtime deployments
- Testing migration safety
- Handling backward compatibility

## Migration Principles

**Backward Compatibility:**
- New code must work with old schema
- Old code must work with new schema (during rollout)
- Never break existing functionality

**Incremental Changes:**
- Small, focused migrations
- One logical change per migration
- Test each migration independently
- Avoid large, complex migrations

**Reversibility:**
- Every migration should have a rollback
- Test rollback in staging first
- Document rollback procedures
- Keep rollback scripts simple

## Migration Tools

**Node.js/TypeScript:**
- Prisma Migrate
- Knex.js
- TypeORM migrations
- Sequelize migrations

**Python:**
- Alembic (SQLAlchemy)
- Django migrations
- Flyway

**Go:**
- golang-migrate
- Goose
- Atlas

**Language-Agnostic:**
- Flyway
- Liquibase
- Atlas

## Migration File Structure

**Naming Convention:**
```
YYYYMMDDHHMMSS_description.ts
20241107143000_add_users_table.ts
```

**Migration Template:**
```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsersTable1234567890 implements MigrationInterface {
  name = 'AddUsersTable1234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE users`);
  }
}
```

## Zero-Downtime Migration Patterns

**Pattern 1: Add Column (Non-Nullable)**
```typescript
// Step 1: Add column as nullable
await queryRunner.query(`
  ALTER TABLE users ADD COLUMN status VARCHAR(50)
`);

// Step 2: Backfill data
await queryRunner.query(`
  UPDATE users SET status = 'active' WHERE status IS NULL
`);

// Step 3: Make column non-nullable
await queryRunner.query(`
  ALTER TABLE users ALTER COLUMN status SET NOT NULL
`);

// Step 4: Deploy new code that uses the column
```

**Pattern 2: Rename Column**
```typescript
// Step 1: Add new column
await queryRunner.query(`
  ALTER TABLE users ADD COLUMN full_name VARCHAR(255)
`);

// Step 2: Copy data
await queryRunner.query(`
  UPDATE users SET full_name = name
`);

// Step 3: Deploy code that writes to both columns
// Step 4: Deploy code that reads from new column
// Step 5: Remove old column (after verification)
await queryRunner.query(`
  ALTER TABLE users DROP COLUMN name
`);
```

**Pattern 3: Split Table**
```typescript
// Step 1: Create new table
await queryRunner.query(`
  CREATE TABLE user_profiles (
    user_id INTEGER REFERENCES users(id),
    bio TEXT,
    avatar_url VARCHAR(255)
  )
`);

// Step 2: Migrate data
await queryRunner.query(`
  INSERT INTO user_profiles (user_id, bio, avatar_url)
  SELECT id, bio, avatar_url FROM users
`);

// Step 3: Deploy code that writes to both tables
// Step 4: Deploy code that reads from new table
// Step 5: Remove columns from old table
```

## Data Migration Strategies

**Batch Processing:**
```typescript
async function migrateData(queryRunner: QueryRunner) {
  const batchSize = 1000;
  let offset = 0;
  
  while (true) {
    const batch = await queryRunner.query(`
      SELECT * FROM old_table
      LIMIT ${batchSize} OFFSET ${offset}
    `);
    
    if (batch.length === 0) break;
    
    await queryRunner.query(`
      INSERT INTO new_table (col1, col2)
      VALUES ${batch.map(row => `('${row.col1}', '${row.col2}')`).join(',')}
    `);
    
    offset += batchSize;
  }
}
```

**Transformation During Migration:**
```typescript
await queryRunner.query(`
  INSERT INTO new_users (id, email, full_name, status)
  SELECT 
    id,
    LOWER(email),
    CONCAT(first_name, ' ', last_name),
    CASE 
      WHEN is_active = 1 THEN 'active'
      ELSE 'inactive'
    END
  FROM old_users
`);
```

## Migration Testing

**Test Checklist:**
- [ ] Migration runs successfully on empty database
- [ ] Migration runs successfully with existing data
- [ ] Rollback works correctly
- [ ] Data integrity maintained
- [ ] No data loss
- [ ] Performance acceptable (test with production-sized data)
- [ ] Foreign key constraints satisfied
- [ ] Indexes created correctly

**Testing Script:**
```bash
#!/bin/bash
# Test migration in isolated environment

# Create test database
createdb test_migration

# Run migration
npm run migrate:up

# Verify data
npm run test:data-integrity

# Test rollback
npm run migrate:down

# Verify rollback
npm run test:schema-rollback

# Cleanup
dropdb test_migration
```

## Migration Versioning

**Version Tracking Table:**
```sql
CREATE TABLE schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  migration_name VARCHAR(255) NOT NULL
);
```

**Check Applied Migrations:**
```typescript
async function getAppliedMigrations(queryRunner: QueryRunner) {
  return await queryRunner.query(`
    SELECT version, migration_name, applied_at
    FROM schema_migrations
    ORDER BY applied_at DESC
  `);
}
```

## Common Migration Operations

**Add Column:**
```typescript
await queryRunner.query(`
  ALTER TABLE users 
  ADD COLUMN phone VARCHAR(20)
`);
```

**Modify Column:**
```typescript
await queryRunner.query(`
  ALTER TABLE users 
  ALTER COLUMN name TYPE VARCHAR(500)
`);
```

**Add Index:**
```typescript
await queryRunner.query(`
  CREATE INDEX idx_users_email ON users(email)
`);
```

**Add Foreign Key:**
```typescript
await queryRunner.query(`
  ALTER TABLE orders
  ADD CONSTRAINT fk_orders_user
  FOREIGN KEY (user_id) REFERENCES users(id)
`);
```

**Create Enum:**
```typescript
await queryRunner.query(`
  CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended')
`);
```

## Rollback Strategies

**Simple Rollback:**
```typescript
public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`DROP TABLE users`);
}
```

**Data Preservation Rollback:**
```typescript
public async down(queryRunner: QueryRunner): Promise<void> {
  // Backup data before dropping
  await queryRunner.query(`
    CREATE TABLE users_backup AS SELECT * FROM users
  `);
  
  await queryRunner.query(`DROP TABLE users`);
}
```

**Partial Rollback:**
```typescript
public async down(queryRunner: QueryRunner): Promise<void> {
  // Remove new column but keep data
  await queryRunner.query(`
    ALTER TABLE users DROP COLUMN IF EXISTS phone
  `);
}
```

## Migration Best Practices

**Do:**
- Test migrations in staging first
- Backup database before production migration
- Use transactions for atomicity
- Keep migrations small and focused
- Document migration purpose
- Test with production-sized data
- Monitor migration performance
- Have rollback plan ready

**Don't:**
- Modify applied migrations
- Skip migration versions
- Run migrations manually in production
- Mix schema and data changes
- Ignore foreign key constraints
- Forget to update indexes
- Leave unused columns/tables

## CI/CD Integration

**GitHub Actions Example:**
```yaml
- name: Run migrations
  run: |
    npm run migrate:status
    npm run migrate:up
    npm run migrate:status
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

- name: Verify migration
  run: npm run test:migration-verification
```

**Deployment Checklist:**
1. Review migration scripts
2. Test in staging environment
3. Backup production database
4. Schedule maintenance window (if needed)
5. Run migration
6. Verify data integrity
7. Deploy new application code
8. Monitor for issues
9. Keep rollback script ready

## Troubleshooting

**Migration Failed Mid-Way:**
```bash
# Check migration status
npm run migrate:status

# Rollback failed migration
npm run migrate:down -- --to <last-successful-version>

# Fix migration script
# Re-run migration
npm run migrate:up
```

**Data Inconsistency:**
```sql
-- Find orphaned records
SELECT * FROM orders 
WHERE user_id NOT IN (SELECT id FROM users);

-- Fix with default value
UPDATE orders 
SET user_id = (SELECT id FROM users LIMIT 1)
WHERE user_id IS NULL;
```

## Resources

- Flyway: https://flywaydb.org/
- Liquibase: https://www.liquibase.org/
- Prisma Migrate: https://www.prisma.io/docs/concepts/components/prisma-migrate
- Alembic: https://alembic.sqlalchemy.org/
- Zero-Downtime Migrations: https://www.braintreepayments.com/blog/safe-operations-for-high-volume-postgresql/
