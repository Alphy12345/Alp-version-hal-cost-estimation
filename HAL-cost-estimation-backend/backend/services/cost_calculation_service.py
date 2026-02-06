from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models.models import MHR, Machine, Duty, OperationType as OperationTypeModel
from typing import Tuple, Optional

class CostCalculationService:
    """Service class for manufacturing cost calculations"""
    
    # Wage rate calculation constants
    CONVENTIONAL_OPERATOR_MONTHLY_WAGE = 15000.0
    CNC_OPERATOR_MONTHLY_WAGE = 20000.0
    HOURS_PER_MONTH_FOR_WAGE = 200.0
    
    # Man-hours estimation based on operation and duty
    # Format: {operation: {duty: hours_per_unit}}
    MAN_HOURS_MATRIX = {
        "turning": {"light": 0.25, "medium": 0.5, "heavy": 1.0},
        "milling": {"light": 0.5, "medium": 1.0, "heavy": 2.0},
        "drilling": {"light": 0.15, "medium": 0.3, "heavy": 0.6},
        "grinding": {"light": 0.3, "medium": 0.6, "heavy": 1.2},
        "boring": {"light": 0.4, "medium": 0.8, "heavy": 1.5},
        "heat_treatment": {"light": 0.5, "medium": 1.0, "heavy": 2.0},
        "welding": {"light": 0.3, "medium": 0.6, "heavy": 1.2},
        "surface_treatment": {"light": 0.2, "medium": 0.4, "heavy": 0.8}
    }
    
    def __init__(self, db: Session):
        self.db = db
    
    def determine_duty_category(
        self, 
        shape: str, 
        dimensions: dict, 
        material: str,
        operation: str
    ) -> str:
        """
        Determine duty category based on dimensions, material, and operation
        """
        mat = (material or "").strip().lower()
        op = (operation or "").strip().lower()

        if mat == "aluminum":
            mat = "aluminium"

        if shape == "round" and all(k in dimensions for k in ("diameter", "length")):
            diameter = float(dimensions["diameter"])
            length = float(dimensions["length"])

            tables = {
                "aluminium": {
                    "light": {"dia_max": 80.0, "len_max": 500.0, "dia_min": 0.0, "len_min": 0.0},
                    "medium": {"dia_min": 80.0, "dia_max": 150.0, "len_min": 500.0, "len_max": 1000.0},
                    "heavy": {"dia_min": 150.0, "dia_max": 300.0, "len_min": 1000.0, "len_max": 2000.0},
                },
                "steel": {
                    "light": {"dia_max": 50.0, "len_max": 200.0, "dia_min": 0.0, "len_min": 0.0},
                    "medium": {"dia_min": 50.0, "dia_max": 100.0, "len_min": 200.0, "len_max": 500.0},
                    "heavy": {"dia_min": 100.0, "dia_max": 150.0, "len_min": 500.0, "len_max": 1500.0},
                },
                "titanium": {
                    "light": {"dia_max": 30.0, "len_max": 150.0, "dia_min": 0.0, "len_min": 0.0},
                    "medium": {"dia_min": 30.0, "dia_max": 60.0, "len_min": 150.0, "len_max": 300.0},
                    "heavy": {"dia_min": 60.0, "dia_max": 100.0, "len_min": 300.0, "len_max": 750.0},
                },
            }

            t = tables.get(mat)
            if not t:
                raise ValueError(f"Unsupported material '{material}' for duty classification")

            if diameter < t["medium"]["dia_min"] and length < t["medium"]["len_min"]:
                return "light"

            if diameter >= t["heavy"]["dia_min"] or length >= t["heavy"]["len_min"]:
                return "heavy"

            return "medium"

        if shape == "rectangular" and "length" in dimensions:
            length = float(dimensions["length"])

            milling_len_tables = {
                "aluminium": {"light_max": 1000.0, "medium_max": 2000.0},
                "steel": {"light_max": 750.0, "medium_max": 1500.0},
                "titanium": {"light_max": 500.0, "medium_max": 1000.0},
            }
            t = milling_len_tables.get(mat)
            if not t:
                raise ValueError(f"Unsupported material '{material}' for duty classification")

            if length < t["light_max"]:
                return "light"
            if length < t["medium_max"]:
                return "medium"
            return "heavy"

        raise ValueError(
            f"Unable to determine duty category for shape '{shape}' and operation '{op}'. "
            "Please provide valid dimensions for duty classification."
        )
    
    def select_machine(
        self,
        operation: str,
        duty: str,
        material: str,
        machine_category: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Select appropriate machine based on operation, duty, and material
        Returns: (machine_name, machine_category)
        """
        # If machine category is provided, use it
        if machine_category:
            category = machine_category
        else:
            # Auto-select based on duty and operation
            if duty == "heavy" or material == "titanium":
                category = "cnc_5axis"
            elif duty == "medium":
                category = "cnc_3axis"
            else:
                category = "conventional"
        
        # Machine naming based on operation and category
        machine_names = {
            "turning": {
                "conventional": "Conventional Lathe",
                "cnc_3axis": "CNC Lathe - 3 Axis",
                "cnc_5axis": "CNC Lathe - 5 Axis",
                "spm": "Special Purpose Lathe"
            },
            "milling": {
                "conventional": "Conventional Milling Machine",
                "cnc_3axis": "CNC Milling - 3 Axis",
                "cnc_5axis": "CNC Milling - 5 Axis",
                "spm": "Special Purpose Mill"
            },
            "drilling": {
                "conventional": "Conventional Drill Press",
                "cnc_3axis": "CNC Drilling Machine",
                "cnc_5axis": "CNC Multi-Axis Drill",
                "spm": "Special Purpose Drill"
            },
            "grinding": {
                "conventional": "Conventional Grinder",
                "cnc_3axis": "CNC Grinder",
                "cnc_5axis": "CNC Precision Grinder",
                "spm": "Special Purpose Grinder"
            },
            "boring": {
                "conventional": "Conventional Boring Machine",
                "cnc_3axis": "CNC Boring Machine",
                "cnc_5axis": "CNC Horizontal Boring",
                "spm": "Special Purpose Boring"
            }
        }
        
        machine_name = machine_names.get(operation, {}).get(
            category, 
            f"{category.upper()} Machine"
        )
        
        return machine_name, category
    
    def get_machine_details(self, machine_name: str, db: Session, operation: Optional[str] = None) -> dict:
        """Get machine details from database.

        NOTE: Machine names are not guaranteed to be unique (e.g., 'Conventional' exists for
        turning, milling, jig boring). If operation is provided, we prefer the row whose
        op_id matches the operation type.
        """

        from sqlalchemy import func, text  # ensure func imported above if not
        import re
        normalized = re.sub(r"[^a-z0-9 ]", " ", str(machine_name).lower())
        normalized = " ".join(normalized.split())
        q = db.query(Machine).filter(
            func.replace(func.lower(func.trim(Machine.name)), "  ", " ") == normalized  # collapse spaces
        )
        candidates = q.all()

        if not candidates:
            # fallback: scan all machines
            all_rows = db.query(Machine).all()
            candidates = [m for m in all_rows if normalized == " ".join(re.sub(r"[^a-z0-9 ]", " ", m.name.lower()).split())]
        if not candidates:
            raise ValueError(f"Machine with name '{machine_name}' not found")

        selected = None

        if operation:
            op_norm = str(operation).strip().lower().replace("_", " ").replace("-", " ")
            op_norm = " ".join(op_norm.split())
            op_compact = "".join(op_norm.split())

            op_row = (
                db.query(OperationTypeModel)
                .filter(func.replace(func.lower(func.trim(OperationTypeModel.operation_name)), " ", "") == op_compact)
                .first()
            )

            # Handle DB variants like 'JIG boring' while API operation is 'boring'
            if not op_row and op_norm == "boring":
                op_row = (
                    db.query(OperationTypeModel)
                    .filter(func.replace(func.lower(func.trim(OperationTypeModel.operation_name)), " ", "").like("%boring%"))
                    .first()
                )

            op_id = op_row.id if op_row else None
            if op_id is not None:
                selected = next((m for m in candidates if getattr(m, "op_id", None) == op_id), None)

        if selected is None:
            selected = candidates[0]

        return {
            "id": selected.id,
            "name": selected.name,
            "operation_type_id": selected.op_id,
        }
    
    def determine_machine_category(self, machine_name: str) -> str:
        """
        Determine machine category from machine name
        """
        name_lower = machine_name.lower()
        
        if "cnc" in name_lower or "precision" in name_lower:
            if "5" in name_lower or "five" in name_lower or "5 axis" in name_lower or "5-axis" in name_lower:
                return "cnc_5axis"
            else:
                return "cnc_3axis"
        elif "spm" in name_lower or "special" in name_lower:
            return "spm"
        else:
            return "conventional"

    def get_wage_rate(self, machine_name: str) -> float:
        """Get Wage Rate (C) in ₹/hr based on selected machine.

        Wage Rate, C = Monthly wages / 200 (Rs/Hour)
        Conventional machine operators : 15000 per month
        CNC/Precision machine operators : 20000 per month
        """
        category = self.determine_machine_category(machine_name)
        if category == "conventional":
            monthly = self.CONVENTIONAL_OPERATOR_MONTHLY_WAGE
        else:
            monthly = self.CNC_OPERATOR_MONTHLY_WAGE
        return monthly / self.HOURS_PER_MONTH_FOR_WAGE
    
    def get_machine_hour_rate(
        self,
        operation: str,
        duty: str,
        machine_name: str,
        db: Session,
        machine_id: Optional[int] = None,
        op_type_id: Optional[int] = None,
        duty_id: Optional[int] = None,
    ) -> float:
        """
        Fetch Machine Hour Rate from database or calculate default
        """
        def _norm(s: Optional[str]) -> str:
            if s is None:
                return ""
            out = s.strip().lower()
            out = out.replace("_", " ")
            out = out.replace("-", " ")
            out = " ".join(out.split())
            if out.endswith(" duty"):
                out = out[: -len(" duty")]
            return out

        def _norm_sql(col):
            # Mirror _norm() behavior in SQL for robust joins/filters.
            # NOTE: we do not collapse repeated spaces in SQL; we compensate by
            # removing spaces on both sides for equality checks.
            return func.lower(func.trim(func.replace(func.replace(col, "_", " "), "-", " ")))

        def _compact(s: str) -> str:
            # Compact spaces for comparisons where SQL can't easily collapse whitespace.
            return "".join(_norm(s).split())

        def _canon_op(s: Optional[str]) -> str:
            out = _norm(s)
            # Treat DB variants like 'jig boring' as the API operation 'boring'
            if out and "boring" in out:
                return "boring"
            return out

        def _resolve_duty_id(d: str) -> Optional[int]:
            d_norm = _norm(d)
            if not d_norm:
                return None
            try:
                duties = db.query(Duty).all()
            except Exception:
                return None
            for du in duties:
                if _norm(getattr(du, "name", None)) == d_norm:
                    return du.id
            return None

        # Prefer deterministic lookup by IDs (matches configuration table exactly)
        try:
            op_id = op_type_id
            if op_id is None and operation:
                op_compact = _compact(operation)
                op_row = (
                    db.query(OperationTypeModel)
                    .filter(func.replace(_norm_sql(OperationTypeModel.operation_name), " ", "") == op_compact)
                    .first()
                )
                if not op_row and _norm(operation) == "boring":
                    op_row = (
                        db.query(OperationTypeModel)
                        .filter(func.replace(_norm_sql(OperationTypeModel.operation_name), " ", "").like("%boring%"))
                        .first()
                    )
                op_id = op_row.id if op_row else None

            du_id = duty_id if duty_id is not None else _resolve_duty_id(duty)
            m_id = machine_id

            if op_id is not None and du_id is not None and m_id is not None:
                rec = (
                    db.query(MHR)
                    .filter(
                        MHR.op_type_id == op_id,
                        MHR.duty_id == du_id,
                        MHR.machine_id == m_id,
                    )
                    .first()
                )
                if rec and rec.machine_hr_rate is not None:
                    return float(rec.machine_hr_rate)
        except Exception:
            pass

        # Prefer MHR configuration table values; do a normalized match to tolerate
        # differences like: "Medium duty" vs "medium", "Turning" vs "turning".
        try:
            op_norm = _canon_op(operation)
            duty_norm = _norm(duty)
            machine_norm = _norm(machine_name)

            # Narrow candidates by operation in SQL first.
            # IMPORTANT: For DB variants like 'JIG boring' while API operation is 'boring',
            # filtering by normalized name would miss rows. If we have an op_type_id from the
            # selected machine, that is the most reliable key.
            q = (
                db.query(MHR)
                .join(OperationTypeModel, MHR.op_type_id == OperationTypeModel.id)
                .join(Duty, MHR.duty_id == Duty.id)
                .join(Machine, MHR.machine_id == Machine.id)
            )
            if op_type_id is not None:
                q = q.filter(MHR.op_type_id == op_type_id)
            else:
                q = q.filter(func.replace(_norm_sql(OperationTypeModel.operation_name), " ", "") == _compact(operation))
            candidates = q.all()

            best = None
            best_score = -1
            for rec in candidates:
                rec_op = _canon_op(getattr(rec.operation_type, "operation_name", None))
                rec_duty = _norm(getattr(rec.duty, "name", None))
                if rec_op != op_norm or rec_duty != duty_norm:
                    continue

                rec_machine = _norm(getattr(rec.machine, "name", None))
                # 2 = exact, 1 = substring match, 0 = mismatch
                if rec_machine == machine_norm:
                    score = 2
                elif rec_machine and machine_norm and (rec_machine in machine_norm or machine_norm in rec_machine):
                    score = 1
                else:
                    score = 0

                if score > best_score:
                    best = rec
                    best_score = score

                if best_score == 2:
                    break

            if best and best.machine_hr_rate is not None:
                try:
                    return float(best.machine_hr_rate)
                except (ValueError, TypeError):
                    pass

            # Fallback: if duty classification doesn't match DB configuration (common for
            # drilling/welding/heat_treatment), accept any duty row for the same operation
            # and best matching machine.
            best = None
            best_score = -1
            for rec in candidates:
                rec_op = _canon_op(getattr(rec.operation_type, "operation_name", None))
                if rec_op != op_norm:
                    continue

                rec_machine = _norm(getattr(rec.machine, "name", None))
                if rec_machine == machine_norm:
                    score = 2
                elif rec_machine and machine_norm and (rec_machine in machine_norm or machine_norm in rec_machine):
                    score = 1
                else:
                    score = 0

                if score > best_score:
                    best = rec
                    best_score = score

                if best_score == 2:
                    break

            if best and best.machine_hr_rate is not None and best_score > 0:
                try:
                    return float(best.machine_hr_rate)
                except (ValueError, TypeError):
                    pass
        except Exception:
            # If database query fails, use defaults
            pass

        raise ValueError(
            "MHR not configured for the selected operation, duty, and machine. "
            "Please add a matching row in the MHR configuration table."
        )
    
    def calculate_man_hours(
        self,
        operation: str,
        duty: str,
        override: Optional[float] = None
    ) -> float:
        """
        Calculate or return man-hours per unit
        """
        if override:
            return override
        
        return self.MAN_HOURS_MATRIX.get(operation, {}).get(duty, 0.5)
    
    def calculate_costs(
        self,
        man_hours: float,
        machine_hour_rate: float,
        wage_rate: float,
        quantity: int,
        miscellaneous_amount: float = 0.0
    ) -> dict:
        """
        Calculate all cost components based on the formula
        
        D = A × (B + C)
        OH = 100% of C × A
        Profit = 10% of (D + OH)
        PF = 2% of D
        Unit Cost = D + OH + Profit + PF
        Total Unit Cost with Misc = Unit Cost + Miscellaneous Amount
        Outsourcing MHR = B + 2C
        """
        # A = man_hours, B = machine_hour_rate, C = wage_rate
        
        # Basic cost per unit: D = A × (B + C)
        basic_cost = man_hours * (machine_hour_rate + wage_rate)
        
        # Overheads: OH = 100% of C × A = C × A
        overheads = wage_rate
        
        # Profit: 10% of (D + OH)
        profit = 0.10 * (basic_cost + overheads)
        
        # Packing & Forwarding: 2% of D
        packing_forwarding = 0.02 * basic_cost
        
        # Unit cost
        unit_cost = basic_cost + overheads + profit + packing_forwarding
        
        # Total unit cost with miscellaneous amount
        total_unit_cost_with_misc = unit_cost + miscellaneous_amount
        
        # Total cost
        total_cost = total_unit_cost_with_misc * quantity
        
        # Outsourcing MHR
        outsourcing_mhr = machine_hour_rate + (2 * wage_rate)
        
        return {
            "man_hours_per_unit": round(man_hours, 4),
            "machine_hour_rate": round(machine_hour_rate, 2),
            "wage_rate": round(wage_rate, 2),
            "basic_cost_per_unit": round(basic_cost, 2),
            "overheads_per_unit": round(overheads, 2),
            "profit_per_unit": round(profit, 2),
            "packing_forwarding_per_unit": round(packing_forwarding, 2),
            "unit_cost": round(unit_cost, 2),
            "total_unit_cost_with_misc": round(total_unit_cost_with_misc, 2),
            "total_cost": round(total_cost, 2),
            "outsourcing_mhr": round(outsourcing_mhr, 2),
            "miscellaneous_amount": round(miscellaneous_amount, 2)
        }