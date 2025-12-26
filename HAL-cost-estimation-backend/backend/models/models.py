from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from ..db import Base

# -------------------------------------------------
# OPERATION TYPE
# -------------------------------------------------
class OperationType(Base):
    __tablename__ = "operation_type"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    operation_name = Column(String, nullable=False)

    machines = relationship("Machine", back_populates="operation_type")
    mhr = relationship("MHR", back_populates="operation_type")


# -------------------------------------------------
# MACHINES
# -------------------------------------------------
class Machine(Base):
    __tablename__ = "machines"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    op_id = Column(Integer, ForeignKey("operation_type.id"))

    operation_type = relationship("OperationType", back_populates="machines")
    machine_selections = relationship("MachineSelection", back_populates="machine")
    mhr = relationship("MHR", back_populates="machine")


# -------------------------------------------------
# DIMENSIONS
# -------------------------------------------------
class Dimension(Base):
    __tablename__ = "dimensions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)

    machine_selections = relationship("MachineSelection", back_populates="dimension")


# -------------------------------------------------
# DUTIES
# -------------------------------------------------
class Duty(Base):
    __tablename__ = "duties"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)

    machine_selections = relationship("MachineSelection", back_populates="duty")
    mhr = relationship("MHR", back_populates="duty")


# -------------------------------------------------
# MATERIALS
# -------------------------------------------------
class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)

    machine_selections = relationship("MachineSelection", back_populates="material")


# -------------------------------------------------
# MACHINE SELECTION
# -------------------------------------------------
class MachineSelection(Base):
    __tablename__ = "machine_selection"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    machine_id = Column(Integer, ForeignKey("machines.id"))
    dimension_id = Column(Integer, ForeignKey("dimensions.id"))
    duty_id = Column(Integer, ForeignKey("duties.id"))
    material_id = Column(Integer, ForeignKey("materials.id"))
    size = Column(String, nullable=True)

    machine = relationship("Machine", back_populates="machine_selections")
    dimension = relationship("Dimension", back_populates="machine_selections")
    duty = relationship("Duty", back_populates="machine_selections")
    material = relationship("Material", back_populates="machine_selections")


# -------------------------------------------------
# MHR (Machine Hour Rate)
# -------------------------------------------------
class MHR(Base):
    __tablename__ = "mhr"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    op_type_id = Column(Integer, ForeignKey("operation_type.id"))
    duty_id = Column(Integer, ForeignKey("duties.id"))
    machine_id = Column(Integer, ForeignKey("machines.id"))

    investment_cost = Column(String)
    elect_power_rating = Column(String)
    elect_power_charges = Column(String)
    available_hrs_per_annum = Column(String)
    utilization_hrs_year = Column(String)
    machine_hr_rate = Column(String)

    operation_type = relationship("OperationType", back_populates="mhr")
    duty = relationship("Duty", back_populates="mhr")
    machine = relationship("Machine", back_populates="mhr")
