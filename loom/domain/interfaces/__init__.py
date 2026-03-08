from abc import ABC, abstractmethod
from typing import TypeVar, Generic, List, Optional

T = TypeVar('T')

class IRepository(ABC, Generic[T]):
    """
    Abstract generic repository interface defining the standard contract
    for data access without leaking any concrete ORM models or database dependencies.
    """
    
    @abstractmethod
    def get_by_id(self, id: str) -> Optional[T]:
        """Retrieve a single entity by its unique identifier."""
        pass
        
    @abstractmethod
    def get_all(self) -> List[T]:
        """Retrieve all entities."""
        pass
        
    @abstractmethod
    def save(self, entity: T) -> T:
        """Persist a new entity or update an existing one."""
        pass
        
    @abstractmethod
    def update(self, id: str, entity: T) -> T:
        """Update an existing entity by its identifier."""
        pass
        
    @abstractmethod
    def delete(self, id: str) -> bool:
        """Delete an entity by its identifier. Returns True if successful."""
        pass
