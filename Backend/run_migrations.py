#!/usr/bin/env python
"""Script to run Alembic migrations."""
import os
import sys
from pathlib import Path

# Add Backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Change to Backend directory for alembic config
os.chdir(backend_dir)

from alembic.config import Config
from alembic import command

def run_migrations():
    """Run all pending migrations."""
    try:
        config = Config("alembic.ini")
        print("🔄 Starting Alembic migration...")
        print(f"Working directory: {os.getcwd()}")
        
        # Get current revision
        print("\n📊 Current database revision:")
        try:
            command.current(config)
        except Exception as e:
            print(f"   (No migrations yet: {e})")
        
        # Run upgrade
        print("\n⬆️  Upgrading database to latest revision...")
        command.upgrade(config, "head")
        
        print("\n✅ Migration completed successfully!")
        
        # Show final revision
        print("\n📊 Final database revision:")
        command.current(config)
        
        return True
        
    except Exception as e:
        print(f"\n❌ Migration failed with error:")
        print(f"   {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_migrations()
    sys.exit(0 if success else 1)
