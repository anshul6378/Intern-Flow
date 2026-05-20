#!/usr/bin/env python
"""Quick database verification."""
import sys
from pathlib import Path

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

try:
    from sqlalchemy import inspect
    from app.core.database import engine
    
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    expected = [
        'users', 'candidate_profiles', 'referrals', 'joining_forms',
        'nda_documents', 'non_worker_id_tasks', 'certificates',
        'workflow_events', 'mentor_assignments'
    ]
    
    print("\n" + "="*70)
    print("✅ DATABASE VERIFICATION SUCCESSFUL")
    print("="*70)
    print(f"\n✅ Successfully connected to PostgreSQL database")
    print(f"\n📋 Tables created:")
    for table in sorted(expected):
        status = "✅" if table in tables else "❌"
        print(f"   {status} {table}")
    
    created_count = len([t for t in expected if t in tables])
    print(f"\n📊 Summary: {created_count}/{len(expected)} core tables created")
    
    if created_count == len(expected):
        print("\n🎉 PHASE 1 COMPLETE - ALL TABLES VERIFIED!")
        print("="*70)
        sys.exit(0)
    else:
        print(f"\n⚠️ Missing tables: {[t for t in expected if t not in tables]}")
        sys.exit(1)
        
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
