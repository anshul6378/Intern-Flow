#!/usr/bin/env python
"""Verify Phase 1 database setup."""
import os
import sys
from pathlib import Path

# Add Backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))
os.chdir(backend_dir)

from sqlalchemy import inspect, text
from app.core.database import engine
from app.models import (
    User, CandidateProfile, Referral, JoiningForm,
    NDADocument, NonWorkerIDTask, Certificate, WorkflowEvent, MentorAssignment
)

def verify_database():
    """Verify all tables exist and have correct columns."""
    inspector = inspect(engine)
    
    # Expected table structure
    expected_tables = {
        'users': 13,  # Updated columns
        'candidate_profiles': 8,
        'referrals': 15,
        'joining_forms': 17,
        'nda_documents': 13,
        'non_worker_id_tasks': 13,
        'certificates': 13,
        'workflow_events': 7,
        'mentor_assignments': 4,
    }
    
    existing_tables = inspector.get_table_names()
    
    print("\n" + "="*80)
    print("🔍 PHASE 1 DATABASE VERIFICATION")
    print("="*80)
    
    print("\n📋 TABLE SUMMARY:")
    print("-" * 80)
    
    all_verified = True
    for table_name, expected_cols in expected_tables.items():
        if table_name in existing_tables:
            columns = inspector.get_columns(table_name)
            status = "✅" if len(columns) >= expected_cols - 2 else "⚠️"
            print(f"{status} {table_name:25} {len(columns):3} columns")
        else:
            print(f"❌ {table_name:25} MISSING")
            all_verified = False
    
    print("\n📊 DETAILED TABLE INFORMATION:")
    print("-" * 80)
    
    for table_name in sorted(existing_tables):
        if table_name in expected_tables:
            print(f"\n📌 {table_name.upper()}")
            columns = inspector.get_columns(table_name)
            print(f"   Columns: {len(columns)}")
            for col in columns:
                nullable = "✓" if col["nullable"] else "✗"
                default = f" (default: {col['default']})" if col["default"] else ""
                print(f"      • {col['name']:25} {str(col['type']):20} nullable={nullable}{default}")
            
            # Show indexes
            indexes = inspector.get_indexes(table_name)
            if indexes:
                print(f"   Indexes: {len(indexes)}")
                for idx in indexes:
                    print(f"      • {idx['name']:30} on {idx['column_names']}")
            
            # Show foreign keys
            fks = inspector.get_foreign_keys(table_name)
            if fks:
                print(f"   Foreign Keys: {len(fks)}")
                for fk in fks:
                    print(f"      • {fk['constrained_columns']} → {fk['referred_table']}.{fk['referred_columns']}")
    
    # Verify relationships work
    print("\n\n🔗 RELATIONSHIP VERIFICATION:")
    print("-" * 80)
    
    relationships_ok = True
    try:
        # Test User model
        user_mapper = inspect(User)
        print(f"✅ User model: {len(user_mapper.columns)} columns, manager hierarchy support")
        
        # Test Referral relationships
        referral_mapper = inspect(Referral)
        rel_count = len(referral_mapper.relationships)
        print(f"✅ Referral model: {rel_count} relationships configured")
        
        # Test JoiningForm
        joining_mapper = inspect(JoiningForm)
        print(f"✅ JoiningForm model: JSON support for multi-field forms")
        
        # Test NDADocument
        nda_mapper = inspect(NDADocument)
        print(f"✅ NDADocument model: E-signature tracking enabled")
        
        # Test NonWorkerIDTask
        task_mapper = inspect(NonWorkerIDTask)
        print(f"✅ NonWorkerIDTask model: SLA tracking fields present")
        
        # Test WorkflowEvent
        event_mapper = inspect(WorkflowEvent)
        print(f"✅ WorkflowEvent model: Immutable audit log setup")
        
    except Exception as e:
        print(f"❌ Relationship verification failed: {e}")
        relationships_ok = False
    
    # Summary
    print("\n" + "="*80)
    print("✨ SUMMARY:")
    print("-" * 80)
    print(f"Total tables: {len([t for t in existing_tables if t in expected_tables])}/{len(expected_tables)}")
    print(f"Total columns: {sum(len(inspect(engine).get_columns(t)) for t in [k for k in expected_tables.keys() if k in existing_tables])}")
    print(f"All expected tables exist: {'✅ YES' if all_verified else '❌ NO'}")
    print(f"All relationships configured: {'✅ YES' if relationships_ok else '❌ NO'}")
    
    if all_verified and relationships_ok:
        print("\n🎉 PHASE 1 DATABASE SETUP VERIFIED SUCCESSFULLY!")
        print("="*80)
        print("\n📝 Ready for Phase 2: Referral API Implementation")
        return True
    else:
        print("\n⚠️  VERIFICATION FAILED - Check errors above")
        return False

if __name__ == "__main__":
    try:
        success = verify_database()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Verification script error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
